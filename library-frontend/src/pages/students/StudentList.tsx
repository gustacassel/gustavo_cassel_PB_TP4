import { useEffect, useMemo, useState } from "react"
import { Badge, Button, Card, Col, Container, Row, Spinner, Table } from "react-bootstrap"
import { Link } from "react-router-dom"
import Swal from "sweetalert2"
import { getCourses } from "../../services/courses-api"
import { createStudent, deleteStudent, getStudents, updateStudent } from "../../services/students-api"
import type { Course } from "../../types/courses"
import {
    STUDENT_STATUSES,
    STUDENT_STATUS_LABELS,
    STUDENT_STATUS_VARIANTS,
    type Student,
    type StudentInput,
    type StudentStatus,
} from "../../types/students"
import "../shared/ListPage.css"

const formatDate = (value: string | null) => {
    if (!value) {
        return "-"
    }

    const date = new Date(value)
    if (Number.isNaN(date.getTime())) {
        return value
    }

    return new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "medium",
    }).format(date)
}

const toInputDate = (value: string | null) => {
    if (!value) {
        return ""
    }

    const date = new Date(value)
    if (Number.isNaN(date.getTime())) {
        return value
    }

    return date.toISOString().split("T")[0]
}

const escapeHtml = (value: string) =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

const courseOptions = (courses: Course[], selectedId: number | null) =>
    [`<option value="">Sem curso</option>`]
        .concat(
            courses.map(
                (course) =>
                    `<option value="${course.id}" ${course.id === selectedId ? "selected" : ""}>${escapeHtml(
                        `${course.name} (${course.code})`,
                    )}</option>`,
            ),
        )
        .join("")

const statusOptions = (selected: StudentStatus) =>
    STUDENT_STATUSES.map(
        (status) =>
            `<option value="${status}" ${status === selected ? "selected" : ""}>${
                STUDENT_STATUS_LABELS[status]
            }</option>`,
    ).join("")

const readForm = (): StudentInput | null => {
    const value = (id: string) => (document.getElementById(id) as HTMLInputElement | null)?.value ?? ""
    const selected = (id: string) => (document.getElementById(id) as HTMLSelectElement | null)?.value ?? ""

    const name = value("student-name").trim()
    const email = value("student-email").trim()
    const enrollmentNumber = value("student-enrollment").trim()
    const birthDate = value("student-birth")
    const semester = value("student-semester")
    const courseId = selected("student-course")
    const status = selected("student-status") as StudentStatus

    if (!name || !email || !enrollmentNumber) {
        Swal.showValidationMessage("Nome, email e matrícula são obrigatórios.")
        return null
    }

    return {
        name,
        email,
        enrollmentNumber,
        birthDate: birthDate || null,
        status: status || "ATIVO",
        currentSemester: semester ? Number(semester) : null,
        courseId: courseId ? Number(courseId) : null,
    }
}

const formHtml = (courses: Course[], student?: Student) => `
    <input id="student-name" class="swal2-input" placeholder="Nome" value="${escapeHtml(student?.name ?? "")}">
    <input id="student-email" class="swal2-input" placeholder="Email" value="${escapeHtml(student?.email ?? "")}">
    <input id="student-enrollment" class="swal2-input" placeholder="Matrícula" value="${escapeHtml(
        student?.enrollmentNumber ?? "",
    )}">
    <input id="student-birth" class="swal2-input" placeholder="Data de nascimento" type="date" value="${toInputDate(
        student?.birthDate ?? null,
    )}">
    <select id="student-course" class="swal2-select">${courseOptions(courses, student?.course?.id ?? null)}</select>
    <select id="student-status" class="swal2-select">${statusOptions(student?.status ?? "ATIVO")}</select>
    <input id="student-semester" class="swal2-input" placeholder="Semestre atual" type="number" min="1" value="${
        student?.currentSemester ?? 1
    }">
`

export default function StudentList() {
    const [students, setStudents] = useState<Student[]>([])
    const [courses, setCourses] = useState<Course[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const totalStudents = students.length
    const activeStudents = useMemo(
        () => students.filter((student) => student.status === "ATIVO").length,
        [students],
    )
    const distinctCourses = useMemo(
        () => new Set(students.map((student) => student.course?.id).filter(Boolean)).size,
        [students],
    )

    useEffect(() => {
        let isMounted = true

        const load = async () => {
            try {
                setIsLoading(true)
                const [studentData, courseData] = await Promise.all([getStudents(), getCourses()])
                if (isMounted) {
                    setStudents(studentData)
                    setCourses(courseData)
                    setError(null)
                }
            } catch (err) {
                if (isMounted) {
                    const message =
                        err instanceof Error
                            ? err.message
                            : "Não foi possível carregar os estudantes."
                    setError(
                        `${message} — verifique se o microsserviço students-api está no ar em http://localhost:8081.`,
                    )
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false)
                }
            }
        }

        load()

        return () => {
            isMounted = false
        }
    }, [])

    const reload = async () => {
        const [studentData, courseData] = await Promise.all([getStudents(), getCourses()])
        setStudents(studentData)
        setCourses(courseData)
    }

    const handleAddStudent = async () => {
        const result = await Swal.fire({
            title: "Adicionar estudante",
            html: formHtml(courses),
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: "Salvar",
            preConfirm: readForm,
        })

        if (!result.isConfirmed || !result.value) {
            return
        }

        try {
            await createStudent(result.value)
            await reload()
            await Swal.fire("Salvo", "Estudante cadastrado com sucesso.", "success")
        } catch (err) {
            const message = err instanceof Error ? err.message : "Não foi possível salvar o estudante."
            await Swal.fire("Erro", message, "error")
        }
    }

    const handleEditStudent = async (student: Student) => {
        const result = await Swal.fire({
            title: "Editar estudante",
            html: formHtml(courses, student),
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: "Atualizar",
            preConfirm: readForm,
        })

        if (!result.isConfirmed || !result.value) {
            return
        }

        try {
            await updateStudent(student.id, result.value)
            await reload()
            await Swal.fire("Atualizado", "Estudante atualizado com sucesso.", "success")
        } catch (err) {
            const message = err instanceof Error ? err.message : "Não foi possível atualizar o estudante."
            await Swal.fire("Erro", message, "error")
        }
    }

    const handleDeleteStudent = async (student: Student) => {
        const result = await Swal.fire({
            title: "Remover estudante?",
            text: `Isso vai excluir "${student.name}".`,
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Excluir",
        })

        if (!result.isConfirmed) {
            return
        }

        try {
            await deleteStudent(student.id)
            await reload()
            await Swal.fire("Excluído", "Estudante removido com sucesso.", "success")
        } catch (err) {
            const message = err instanceof Error ? err.message : "Não foi possível remover o estudante."
            await Swal.fire("Erro", message, "error")
        }
    }

    return (
        <Container className="py-5 list-page">
            <div className="list-hero mb-4">
                <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
                    <div>
                        <p className="eyebrow">Microsserviço students-api</p>
                        <h1 className="mb-2">Estudantes</h1>
                        <p className="text-secondary mb-0">
                            Cadastro de alunos e vínculo com o curso, servido pelo microsserviço na porta 8081.
                        </p>
                    </div>
                    <div className="d-flex gap-2 flex-wrap">
                        <Link to="/" className="btn btn-outline-secondary">
                            Voltar ao início
                        </Link>
                        <Link to="/courses" className="btn btn-outline-primary">
                            Cursos
                        </Link>
                        <Button variant="primary" onClick={handleAddStudent}>
                            <i className="bi bi-person-plus me-2" />
                            Novo estudante
                        </Button>
                    </div>
                </div>
            </div>

            <Row className="g-4 mb-4">
                {[
                    { label: "Total de estudantes", value: totalStudents.toString() },
                    { label: "Ativos", value: activeStudents.toString() },
                    { label: "Cursos com alunos", value: distinctCourses.toString() },
                ].map((metric) => (
                    <Col md={4} key={metric.label}>
                        <Card className="border-0 shadow-sm h-100 metric-card">
                            <Card.Body>
                                <p className="text-secondary mb-1">{metric.label}</p>
                                <h3 className="mb-0">{metric.value}</h3>
                            </Card.Body>
                        </Card>
                    </Col>
                ))}
            </Row>

            <Card className="border-0 shadow-sm list-card">
                <Card.Body>
                    <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
                        <h5 className="mb-0">Registro de estudantes</h5>
                        {isLoading ? (
                            <div className="d-flex align-items-center gap-2 text-secondary">
                                <Spinner animation="border" size="sm" />
                                Carregando
                            </div>
                        ) : (
                            <Button variant="outline-primary" size="sm" onClick={reload}>
                                Atualizar lista
                            </Button>
                        )}
                    </div>
                    {error ? (
                        <div className="alert alert-danger mb-0" role="alert">
                            {error}
                        </div>
                    ) : (
                        <Table responsive hover className="align-middle mb-0 list-table">
                            <thead>
                                <tr>
                                    <th>Nome</th>
                                    <th>Email</th>
                                    <th>Matrícula</th>
                                    <th>Curso</th>
                                    <th>Semestre</th>
                                    <th>Situação</th>
                                    <th>Nascimento</th>
                                    <th className="text-end">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {students.map((student) => (
                                    <tr key={student.id}>
                                        <td>{student.name}</td>
                                        <td>{student.email}</td>
                                        <td>{student.enrollmentNumber}</td>
                                        <td>
                                            {student.course ? (
                                                <>
                                                    {student.course.name}{" "}
                                                    <span className="text-secondary">({student.course.code})</span>
                                                </>
                                            ) : (
                                                <span className="text-secondary">-</span>
                                            )}
                                        </td>
                                        <td>{student.currentSemester ?? "-"}</td>
                                        <td>
                                            <Badge bg={STUDENT_STATUS_VARIANTS[student.status]}>
                                                {STUDENT_STATUS_LABELS[student.status]}
                                            </Badge>
                                        </td>
                                        <td>{formatDate(student.birthDate)}</td>
                                        <td className="text-end">
                                            <Button
                                                variant="outline-secondary"
                                                size="sm"
                                                className="me-2"
                                                onClick={() => handleEditStudent(student)}
                                            >
                                                Editar
                                            </Button>
                                            <Button
                                                variant="outline-danger"
                                                size="sm"
                                                onClick={() => handleDeleteStudent(student)}
                                            >
                                                Excluir
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                                {!isLoading && students.length === 0 && (
                                    <tr>
                                        <td colSpan={8} className="text-center text-secondary py-4">
                                            Nenhum estudante cadastrado ainda.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </Table>
                    )}
                </Card.Body>
            </Card>
        </Container>
    )
}
