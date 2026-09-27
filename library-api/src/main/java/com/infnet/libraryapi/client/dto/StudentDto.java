package com.infnet.libraryapi.client.dto;

/**
 * Projecao somente-leitura do estudante: so os campos que a library-api usa.
 * Campos desconhecidos sao ignorados, entao o students-api pode evoluir o
 * modelo dele sem quebrar este servico.
 */
public record StudentDto(
        Long id,
        String name,
        String email,
        String enrollmentNumber,
        String status,
        CourseDto course
) {
    private static final String ACTIVE_STATUS = "ATIVO";

    public boolean isActive() {
        return ACTIVE_STATUS.equalsIgnoreCase(status);
    }
}
