package com.infnet.libraryapi.service;

import com.infnet.libraryapi.client.StudentClient;
import com.infnet.libraryapi.client.dto.StudentDto;
import com.infnet.libraryapi.exception.StudentServiceUnavailableException;
import feign.FeignException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cloud.client.circuitbreaker.CircuitBreakerFactory;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Ponto unico de acesso ao microsservico students-api, com circuit breaker.
 * Tem dois modos deliberados: <b>estrito</b> ({@link #findRequired(Long)}),
 * usado ao criar emprestimo, propaga a indisponibilidade; <b>tolerante</b>
 * ({@link #tryFindById(Long)} / {@link #indexAll()}), usado so para enriquecer
 * listagens, devolve vazio e deixa a library-api responder degradada.
 */
@Service
public class StudentGateway {
    private static final Logger log = LoggerFactory.getLogger(StudentGateway.class);
    private static final String CIRCUIT_NAME = "students-api";

    private final StudentClient client;
    private final CircuitBreakerFactory<?, ?> circuitBreakerFactory;

    public StudentGateway(StudentClient client, CircuitBreakerFactory<?, ?> circuitBreakerFactory) {
        this.client = client;
        this.circuitBreakerFactory = circuitBreakerFactory;
    }

    /**
     * @return o aluno, ou vazio se ele realmente nao existe (HTTP 404)
     * @throws StudentServiceUnavailableException se o microsservico nao respondeu
     */
    public Optional<StudentDto> findRequired(Long id) {
        return circuitBreakerFactory.create(CIRCUIT_NAME).run(
                () -> fetchById(id),
                throwable -> {
                    throw new StudentServiceUnavailableException(
                            "Microsservico de estudantes indisponivel no momento", throwable);
                });
    }

    /** Devolve vazio tanto para "nao existe" quanto para "servico fora do ar". */
    public Optional<StudentDto> tryFindById(Long id) {
        return circuitBreakerFactory.create(CIRCUIT_NAME).run(
                () -> fetchById(id),
                throwable -> {
                    log.warn("Nao foi possivel consultar o estudante {}: {}", id, throwable.getMessage());
                    return Optional.empty();
                });
    }

    /**
     * Uma unica chamada HTTP para a lista inteira, em vez de uma por emprestimo.
     *
     * @return mapa id -> aluno, ou vazio se o microsservico nao respondeu
     */
    public Map<Long, StudentDto> indexAll() {
        List<StudentDto> students = circuitBreakerFactory.create(CIRCUIT_NAME).run(
                client::findAll,
                throwable -> {
                    log.warn("Nao foi possivel listar os estudantes: {}", throwable.getMessage());
                    return List.of();
                });

        if (students.isEmpty()) {
            return Collections.emptyMap();
        }

        return students.stream().collect(Collectors.toMap(StudentDto::id, Function.identity()));
    }

    private Optional<StudentDto> fetchById(Long id) {
        try {
            return Optional.ofNullable(client.findById(id));
        } catch (FeignException.NotFound ex) {
            // 404 e uma resposta valida do microsservico, nao uma falha:
            // nao deve abrir o circuito.
            return Optional.empty();
        }
    }
}
