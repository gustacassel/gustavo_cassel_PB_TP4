package com.infnet.libraryapi.service;

import com.infnet.libraryapi.client.dto.StudentDto;
import com.infnet.libraryapi.dto.LoanRequest;
import com.infnet.libraryapi.dto.LoanResponse;
import com.infnet.libraryapi.exception.BusinessException;
import com.infnet.libraryapi.model.AuditAction;
import com.infnet.libraryapi.model.Loan;
import com.infnet.libraryapi.model.LoanStatus;
import com.infnet.libraryapi.repository.BookRepository;
import com.infnet.libraryapi.repository.LoanRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class LoanService {
    private static final String ENTITY_NAME = "LOAN";
    private static final int DEFAULT_LOAN_DAYS = 14;

    private final LoanRepository repository;
    private final BookRepository bookRepository;
    private final StudentGateway studentGateway;
    private final AuditService auditService;

    public LoanService(LoanRepository repository,
                       BookRepository bookRepository,
                       StudentGateway studentGateway,
                       AuditService auditService) {
        this.repository = repository;
        this.bookRepository = bookRepository;
        this.studentGateway = studentGateway;
        this.auditService = auditService;
    }

    public List<Loan> findAll() {
        return repository.findAll();
    }

    public Optional<Loan> findById(Long id) {
        return repository.findById(id);
    }

    public List<Loan> findByStatus(LoanStatus status) {
        return repository.findByStatus(status);
    }

    public List<Loan> findByStudent(Long studentId) {
        return repository.findByStudentId(studentId);
    }

    public List<Loan> findByBook(Long bookId) {
        return repository.findByBookId(bookId);
    }

    public List<Loan> findOverdue() {
        return repository.findOverdue(LocalDate.now());
    }

    /** Uma unica chamada remota enriquece a lista inteira. */
    public List<LoanResponse> enrich(List<Loan> loans) {
        if (loans.isEmpty()) {
            return List.of();
        }

        Map<Long, StudentDto> students = studentGateway.indexAll();
        return loans.stream()
                .map(loan -> LoanResponse.of(loan, students.get(loan.getStudentId())))
                .toList();
    }

    public Optional<LoanResponse> enrich(Loan loan) {
        return Optional.of(LoanResponse.of(loan, studentGateway.tryFindById(loan.getStudentId()).orElse(null)));
    }

    /**
     * Valida o livro localmente e o aluno no microsservico antes de gravar.
     *
     * @throws BusinessException se livro/aluno nao existem ou o aluno nao esta ativo
     * @throws com.infnet.libraryapi.exception.StudentServiceUnavailableException
     *         se o microsservico nao responder
     */
    @Transactional
    public LoanResponse create(LoanRequest request) {
        var book = bookRepository.findById(request.bookId())
                .orElseThrow(() -> new BusinessException("Livro %d nao encontrado".formatted(request.bookId())));

        var student = studentGateway.findRequired(request.studentId())
                .orElseThrow(() -> new BusinessException(
                        "Estudante %d nao encontrado no microsservico de estudantes".formatted(request.studentId())));

        if (!student.isActive()) {
            throw new BusinessException(
                    "O estudante '%s' esta com situacao %s e nao pode pegar livros emprestados"
                            .formatted(student.name(), student.status()));
        }

        var loan = new Loan();
        loan.setBook(book);
        loan.setStudentId(student.id());
        loan.setStudentName(student.name());
        loan.setLoanDate(request.loanDate() != null ? request.loanDate() : LocalDate.now());
        loan.setDueDate(request.dueDate() != null
                ? request.dueDate()
                : loan.getLoanDate().plusDays(DEFAULT_LOAN_DAYS));
        loan.setStatus(LoanStatus.ACTIVE);

        var saved = repository.save(loan);
        auditService.record(ENTITY_NAME, saved.getId(), AuditAction.CREATE,
                "Emprestimo criado: livro '%s' para aluno '%s' (id %d), devolucao ate %s"
                        .formatted(book.getTitle(), student.name(), student.id(), saved.getDueDate()));
        return LoanResponse.of(saved, student);
    }

    @Transactional
    public Optional<Loan> returnLoan(Long id) {
        var loan = repository.findById(id);
        if (loan.isEmpty() || loan.get().getStatus() == LoanStatus.RETURNED) {
            return Optional.empty();
        }

        var returnedLoan = loan.get();
        returnedLoan.setReturnDate(LocalDate.now());
        returnedLoan.setStatus(LoanStatus.RETURNED);

        var saved = repository.save(returnedLoan);
        auditService.record(ENTITY_NAME, saved.getId(), AuditAction.UPDATE,
                "Emprestimo devolvido em %s: livro '%s' (aluno '%s')"
                        .formatted(saved.getReturnDate(), saved.getBook().getTitle(), saved.getStudentName()));
        return Optional.of(saved);
    }

    @Transactional
    public boolean delete(Long id) {
        var loan = repository.findById(id);
        if (loan.isEmpty()) {
            return false;
        }

        repository.delete(loan.get());
        auditService.record(ENTITY_NAME, id, AuditAction.DELETE,
                "Emprestimo removido: livro '%s' (aluno '%s')"
                        .formatted(loan.get().getBook().getTitle(), loan.get().getStudentName()));
        return true;
    }
}
