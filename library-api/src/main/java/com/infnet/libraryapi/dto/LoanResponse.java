package com.infnet.libraryapi.dto;

import com.infnet.libraryapi.client.dto.StudentDto;
import com.infnet.libraryapi.model.Loan;
import com.infnet.libraryapi.model.LoanStatus;

import java.time.LocalDate;

/**
 * Composicao dos dois servicos: livro e datas vem do librarydb, nome/matricula/
 * curso vem do students-api. Com o microsservico fora do ar os campos remotos
 * caem para o nome copiado no emprestimo e {@code studentDataAvailable} vira false.
 */
public record LoanResponse(
        Long id,
        Long bookId,
        String bookTitle,
        String bookAuthor,
        Long studentId,
        String studentName,
        String studentEnrollmentNumber,
        String studentCourseName,
        boolean studentDataAvailable,
        LocalDate loanDate,
        LocalDate dueDate,
        LocalDate returnDate,
        LoanStatus status
) {
    public static LoanResponse of(Loan loan, StudentDto student) {
        var book = loan.getBook();
        return new LoanResponse(
                loan.getId(),
                book != null ? book.getId() : null,
                book != null ? book.getTitle() : null,
                book != null ? book.getAuthor() : null,
                loan.getStudentId(),
                student != null ? student.name() : loan.getStudentName(),
                student != null ? student.enrollmentNumber() : null,
                student != null && student.course() != null ? student.course().name() : null,
                student != null,
                loan.getLoanDate(),
                loan.getDueDate(),
                loan.getReturnDate(),
                loan.getStatus());
    }
}
