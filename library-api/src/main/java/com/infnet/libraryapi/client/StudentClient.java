package com.infnet.libraryapi.client;

import com.infnet.libraryapi.client.dto.StudentDto;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

import java.util.List;

/** Cliente declarativo (Spring Cloud OpenFeign) para o microsservico students-api. */
@FeignClient(name = "students-api", url = "${students-api.url}")
public interface StudentClient {

    @GetMapping("/api/students")
    List<StudentDto> findAll();

    @GetMapping("/api/students/{id}")
    StudentDto findById(@PathVariable("id") Long id);
}
