package com.infnet.libraryapi.service;

import com.infnet.libraryapi.client.StudentClient;
import com.infnet.libraryapi.client.dto.CourseDto;
import com.infnet.libraryapi.client.dto.StudentDto;
import com.infnet.libraryapi.dto.LoanRequest;
import com.infnet.libraryapi.exception.BusinessException;
import com.infnet.libraryapi.exception.StudentServiceUnavailableException;
import com.infnet.libraryapi.model.AuditAction;
import com.infnet.libraryapi.model.Book;
import com.infnet.libraryapi.model.LoanStatus;
import feign.FeignException;
import feign.Request;
import feign.RequestTemplate;
import feign.Response;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.BDDMockito.given;

/**
 * Integracao com o microsservico students-api, com o cliente Feign mockado para
 * simular aluno ok, aluno inexistente (404) e microsservico fora do ar.
 *
 * <p>O circuit breaker e configurado para nao abrir durante os testes, senao um
 * cenario de falha contaminaria os seguintes conforme a ordem de execucao.</p>
 */
@SpringBootTest
@TestPropertySource(properties = {
        "resilience4j.circuitbreaker.instances.students-api.minimum-number-of-calls=1000"
})
@Transactional
class StudentIntegrationTest {

    private static final Long STUDENT_ID = 42L;

    @Autowired
    private LoanService loanService;

    @Autowired
    private StudentGateway studentGateway;

    @Autowired
    private BookService bookService;

    @Autowired
    private AuditService auditService;

    @MockitoBean
    private StudentClient studentClient;

    private Book book;

    @BeforeEach
    void setUp() {
        var newBook = new Book();
        newBook.setTitle("Clean Code");
        newBook.setAuthor("Robert C. Martin");
        book = bookService.save(newBook);
    }

    private StudentDto student(String status) {
        return new StudentDto(STUDENT_ID, "Maria Silva", "maria@infnet.edu.br", "2026001",
                status, new CourseDto(1L, "Engenharia de Software", "ESW"));
    }

    private FeignException.NotFound notFound() {
        var request = Request.create(Request.HttpMethod.GET, "/api/students/" + STUDENT_ID,
                Map.of(), null, StandardCharsets.UTF_8, new RequestTemplate());
        var response = Response.builder().status(404).request(request).build();
        return (FeignException.NotFound) FeignException.errorStatus("StudentClient#findById(Long)", response);
    }

    @Test
    void shouldCreateLoanUsingStudentDataFromTheMicroservice() {
        given(studentClient.findById(STUDENT_ID)).willReturn(student("ATIVO"));

        var response = loanService.create(new LoanRequest(book.getId(), STUDENT_ID, null, null));

        assertThat(response.id()).isNotNull();
        assertThat(response.bookTitle()).isEqualTo("Clean Code");
        assertThat(response.studentId()).isEqualTo(STUDENT_ID);
        assertThat(response.studentName()).isEqualTo("Maria Silva");
        assertThat(response.studentEnrollmentNumber()).isEqualTo("2026001");
        assertThat(response.studentCourseName()).isEqualTo("Engenharia de Software");
        assertThat(response.studentDataAvailable()).isTrue();
        assertThat(response.status()).isEqualTo(LoanStatus.ACTIVE);
        assertThat(response.dueDate()).isEqualTo(response.loanDate().plusDays(14));
    }

    @Test
    void shouldRejectLoanWhenStudentDoesNotExistInTheMicroservice() {
        given(studentClient.findById(anyLong())).willThrow(notFound());

        assertThatThrownBy(() -> loanService.create(new LoanRequest(book.getId(), STUDENT_ID, null, null)))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("nao encontrado no microsservico");
    }

    @Test
    void shouldRejectLoanWhenStudentIsNotActive() {
        given(studentClient.findById(STUDENT_ID)).willReturn(student("TRANCADO"));

        assertThatThrownBy(() -> loanService.create(new LoanRequest(book.getId(), STUDENT_ID, null, null)))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("TRANCADO");
    }

    @Test
    void shouldRejectLoanWhenTheMicroserviceIsDown() {
        given(studentClient.findById(anyLong()))
                .willThrow(new RuntimeException("Connection refused: localhost:8081"));

        assertThatThrownBy(() -> loanService.create(new LoanRequest(book.getId(), STUDENT_ID, null, null)))
                .isInstanceOf(StudentServiceUnavailableException.class)
                .hasMessageContaining("indisponivel");
    }

    @Test
    void shouldRejectLoanWhenBookDoesNotExist() {
        given(studentClient.findById(STUDENT_ID)).willReturn(student("ATIVO"));

        assertThatThrownBy(() -> loanService.create(new LoanRequest(999_999L, STUDENT_ID, null, null)))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("Livro");
    }

    @Test
    void shouldStillListLoansWhenTheMicroserviceIsDown() {
        given(studentClient.findById(STUDENT_ID)).willReturn(student("ATIVO"));
        loanService.create(new LoanRequest(book.getId(), STUDENT_ID, null, null));

        // a partir daqui o microsservico "cai"
        given(studentClient.findAll()).willThrow(new RuntimeException("Connection refused: localhost:8081"));

        var loans = loanService.enrich(loanService.findByStudent(STUDENT_ID));

        assertThat(loans).hasSize(1);
        assertThat(loans.get(0).studentDataAvailable()).isFalse();
        // cai para o nome copiado no momento do emprestimo
        assertThat(loans.get(0).studentName()).isEqualTo("Maria Silva");
        assertThat(loans.get(0).studentEnrollmentNumber()).isNull();
        assertThat(loans.get(0).bookTitle()).isEqualTo("Clean Code");
    }

    @Test
    void shouldEnrichListWithASingleRemoteCallForAllLoans() {
        given(studentClient.findById(STUDENT_ID)).willReturn(student("ATIVO"));
        loanService.create(new LoanRequest(book.getId(), STUDENT_ID, null, null));
        loanService.create(new LoanRequest(book.getId(), STUDENT_ID, null, null));
        loanService.create(new LoanRequest(book.getId(), STUDENT_ID, null, null));

        given(studentClient.findAll()).willReturn(List.of(student("ATIVO")));

        var loans = loanService.enrich(loanService.findByStudent(STUDENT_ID));

        assertThat(loans).hasSize(3);
        assertThat(loans).allMatch(loan -> loan.studentDataAvailable()
                && "Engenharia de Software".equals(loan.studentCourseName()));
    }

    @Test
    void shouldReturnEmptyFromGatewayWhenStudentIsNotFound() {
        given(studentClient.findById(anyLong())).willThrow(notFound());

        assertThat(studentGateway.findRequired(STUDENT_ID)).isEmpty();
        assertThat(studentGateway.tryFindById(STUDENT_ID)).isEmpty();
    }

    @Test
    void shouldSwallowFailuresInTheLenientGatewayPath() {
        given(studentClient.findById(anyLong())).willThrow(new RuntimeException("timeout"));
        given(studentClient.findAll()).willThrow(new RuntimeException("timeout"));

        assertThat(studentGateway.tryFindById(STUDENT_ID)).isEmpty();
        assertThat(studentGateway.indexAll()).isEmpty();
    }

    @Test
    void shouldRecordLoanHistoryWithTheRemoteStudentName() {
        given(studentClient.findById(STUDENT_ID)).willReturn(student("ATIVO"));

        var created = loanService.create(new LoanRequest(book.getId(), STUDENT_ID, null, null));
        loanService.returnLoan(created.id());

        var history = auditService.findByEntityAndId("LOAN", created.id());

        assertThat(history).hasSize(2);
        assertThat(history)
                .extracting(log -> log.getAction())
                .containsExactlyInAnyOrder(AuditAction.CREATE, AuditAction.UPDATE);
        assertThat(history)
                .filteredOn(log -> log.getAction() == AuditAction.CREATE)
                .first()
                .satisfies(log -> assertThat(log.getDetails())
                        .contains("Maria Silva")
                        .contains("Clean Code"));
    }
}
