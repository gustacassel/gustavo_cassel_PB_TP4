package com.infnet.libraryapi.exception;

/**
 * Separa "o aluno nao existe" (regra de negocio, 409) de "nao consegui falar
 * com o outro servico" (indisponibilidade, 503).
 */
public class StudentServiceUnavailableException extends RuntimeException {

    public StudentServiceUnavailableException(String message, Throwable cause) {
        super(message, cause);
    }
}
