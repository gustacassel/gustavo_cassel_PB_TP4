package com.infnet.libraryapi.controller;

import com.infnet.libraryapi.client.dto.StudentDto;
import com.infnet.libraryapi.service.StudentGateway;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * A library-api nao e dona destes dados: apenas repassa a consulta via Feign.
 * Por isso ficam sob {@code /api/integration} e sao somente-leitura - qualquer
 * escrita vai direto ao microsservico.
 */
@RestController
@RequestMapping("/api/integration/students")
@CrossOrigin(origins = "*", allowedHeaders = "*")
public final class StudentDirectoryController {
    private final StudentGateway studentGateway;

    public StudentDirectoryController(StudentGateway studentGateway) {
        this.studentGateway = studentGateway;
    }

    @GetMapping
    public List<StudentDto> getAll() {
        return List.copyOf(studentGateway.indexAll().values());
    }

    @GetMapping("/{id}")
    public ResponseEntity<StudentDto> getById(@PathVariable Long id) {
        return studentGateway.findRequired(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /** Diagnostico da integracao: o microsservico esta respondendo? */
    @GetMapping("/health")
    public Map<String, Object> health() {
        var students = studentGateway.indexAll();
        return Map.of(
                "service", "students-api",
                "reachable", !students.isEmpty(),
                "studentCount", students.size());
    }
}
