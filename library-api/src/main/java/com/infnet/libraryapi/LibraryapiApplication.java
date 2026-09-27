package com.infnet.libraryapi;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.openfeign.EnableFeignClients;

@SpringBootApplication
@EnableFeignClients
public class LibraryapiApplication {

    public static void main(String[] args) {
        SpringApplication.run(LibraryapiApplication.class, args);
    }

}
