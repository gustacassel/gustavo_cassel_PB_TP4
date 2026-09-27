import { apiClient } from "./api-client";

/**
 * Endpoint da library-api que responde consultando o students-api via Feign:
 * "reachable: true" prova que os dois serviços se falam, não apenas que o
 * front-end alcança cada um.
 */
export interface StudentsIntegrationHealth {
    service: string
    reachable: boolean
    studentCount: number
}

export async function getStudentsIntegrationHealth(): Promise<StudentsIntegrationHealth> {
    return apiClient<StudentsIntegrationHealth>("/api/integration/students/health")
}
