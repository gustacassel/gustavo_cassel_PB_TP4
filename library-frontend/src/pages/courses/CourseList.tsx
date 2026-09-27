import { useEffect, useMemo, useState } from "react"
import { Badge, Button, Card, Col, Container, Row, Spinner, Table } from "react-bootstrap"
import { Link } from "react-router-dom"
import Swal from "sweetalert2"
import { createCourse, deleteCourse, getCourseSummary, updateCourse } from "../../services/courses-api"
import {
    DEGREE_LEVELS,
    DEGREE_LEVEL_LABELS,
    type CourseInput,
    type CourseSummary,
    type DegreeLevel,
} from "../../types/courses"
import "../shared/ListPage.css"

const escapeHtml = (value: string) =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

const levelOptions = (selected: DegreeLevel) =>
    DEGREE_LEVELS.map(
        (level) =>
            `<option value="${level}" ${level === selected ? "selected" : ""}>${
                DEGREE_LEVEL_LABELS[level]
            }</option>`,
    ).join("")

const readForm = (): CourseInput | null => {
    const value = (id: string) => (document.getElementById(id) as HTMLInputElement | null)?.value ?? ""
    const selected = (id: string) => (document.getElementById(id) as HTMLSelectElement | null)?.value ?? ""

    const name = value("course-name").trim()
    const code = value("course-code").trim()
    const department = value("course-department").trim()
    const durationSemesters = Number(value("course-duration"))
    const degreeLevel = selected("course-level") as DegreeLevel

    if (!name || !code) {
        Swal.showValidationMessage("Nome e código são obrigatórios.")
        return null
    }

    if (!durationSemesters || durationSemesters < 1 || durationSemesters > 20) {
        Swal.showValidationMessage("A duração deve ficar entre 1 e 20 semestres.")
        return null
    }

    return {
        name,
        code,
        degreeLevel: degreeLevel || "GRADUACAO",
        durationSemesters,
        department: department || null,
    }
}

const formHtml = (course?: CourseSummary) => `
    <input id="course-name" class="swal2-input" placeholder="Nome do curso" value="${escapeHtml(
        course?.name ?? "",
    )}">
    <input id="course-code" class="swal2-input" placeholder="Código (ex.: ESW)" value="${escapeHtml(
        course?.code ?? "",
    )}">
    <select id="course-level" class="swal2-select">${levelOptions(course?.degreeLevel ?? "GRADUACAO")}</select>
    <input id="course-duration" class="swal2-input" placeholder="Duração em semestres" type="number" min="1" max="20" value="${
        course?.durationSemesters ?? 8
    }">
    <input id="course-department" class="swal2-input" placeholder="Departamento" value="${escapeHtml(
        course?.department ?? "",
    )}">
`

export default function CourseList() {
    const [courses, setCourses] = useState<CourseSummary[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const totalCourses = courses.length
    const totalActiveStudents = useMemo(
        () => courses.reduce((sum, course) => sum + course.activeStudents, 0),
        [courses],
    )
    const longestCourse = useMemo(
        () => courses.reduce((max, course) => Math.max(max, course.durationSemesters), 0),
        [courses],
    )

    useEffect(() => {
        let isMounted = true

        const load = async () => {
            try {
                setIsLoading(true)
                const data = await getCourseSummary()
                if (isMounted) {
                    setCourses(data)
                    setError(null)
                }
            } catch (err) {
                if (isMounted) {
                    const message = err instanceof Error ? err.message : "Não foi possível carregar os cursos."
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
        setCourses(await getCourseSummary())
    }

    const handleAddCourse = async () => {
        const result = await Swal.fire({
            title: "Adicionar curso",
            html: formHtml(),
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: "Salvar",
            preConfirm: readForm,
        })

        if (!result.isConfirmed || !result.value) {
            return
        }

        try {
            await createCourse(result.value)
            await reload()
            await Swal.fire("Salvo", "Curso cadastrado com sucesso.", "success")
        } catch (err) {
            const message = err instanceof Error ? err.message : "Não foi possível salvar o curso."
            await Swal.fire("Erro", message, "error")
        }
    }

    const handleEditCourse = async (course: CourseSummary) => {
        const result = await Swal.fire({
            title: "Editar curso",
            html: formHtml(course),
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: "Atualizar",
            preConfirm: readForm,
        })

        if (!result.isConfirmed || !result.value) {
            return
        }

        try {
            await updateCourse(course.id, result.value)
            await reload()
            await Swal.fire("Atualizado", "Curso atualizado com sucesso.", "success")
        } catch (err) {
            const message = err instanceof Error ? err.message : "Não foi possível atualizar o curso."
            await Swal.fire("Erro", message, "error")
        }
    }

    const handleDeleteCourse = async (course: CourseSummary) => {
        const result = await Swal.fire({
            title: "Remover curso?",
            text: `Isso vai excluir "${course.name}".`,
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Excluir",
        })

        if (!result.isConfirmed) {
            return
        }

        try {
            await deleteCourse(course.id)
            await reload()
            await Swal.fire("Excluído", "Curso removido com sucesso.", "success")
        } catch (err) {
            // o microsserviço recusa com 409 se o curso ainda tem alunos
            const message = err instanceof Error ? err.message : "Não foi possível remover o curso."
            await Swal.fire("Erro", message, "error")
        }
    }

    return (
        <Container className="py-5 list-page">
            <div className="list-hero mb-4">
                <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
                    <div>
                        <p className="eyebrow">Microsserviço students-api</p>
                        <h1 className="mb-2">Cursos</h1>
                        <p className="text-secondary mb-0">
                            Cursos oferecidos e quantos alunos ativos cada um tem.
                        </p>
                    </div>
                    <div className="d-flex gap-2 flex-wrap">
                        <Link to="/" className="btn btn-outline-secondary">
                            Voltar ao início
                        </Link>
                        <Link to="/students" className="btn btn-outline-primary">
                            Estudantes
                        </Link>
                        <Button variant="primary" onClick={handleAddCourse}>
                            <i className="bi bi-mortarboard me-2" />
                            Novo curso
                        </Button>
                    </div>
                </div>
            </div>

            <Row className="g-4 mb-4">
                {[
                    { label: "Total de cursos", value: totalCourses.toString() },
                    { label: "Alunos ativos", value: totalActiveStudents.toString() },
                    { label: "Maior duração", value: longestCourse ? `${longestCourse} semestres` : "-" },
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
                        <h5 className="mb-0">Catálogo de cursos</h5>
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
                                    <th>Curso</th>
                                    <th>Código</th>
                                    <th>Nível</th>
                                    <th>Duração</th>
                                    <th>Departamento</th>
                                    <th>Alunos ativos</th>
                                    <th className="text-end">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {courses.map((course) => (
                                    <tr key={course.id}>
                                        <td>{course.name}</td>
                                        <td>{course.code}</td>
                                        <td>{DEGREE_LEVEL_LABELS[course.degreeLevel]}</td>
                                        <td>{course.durationSemesters} semestres</td>
                                        <td>{course.department ?? "-"}</td>
                                        <td>
                                            <Badge bg={course.activeStudents > 0 ? "primary" : "secondary"}>
                                                {course.activeStudents}
                                            </Badge>
                                        </td>
                                        <td className="text-end">
                                            <Button
                                                variant="outline-secondary"
                                                size="sm"
                                                className="me-2"
                                                onClick={() => handleEditCourse(course)}
                                            >
                                                Editar
                                            </Button>
                                            <Button
                                                variant="outline-danger"
                                                size="sm"
                                                onClick={() => handleDeleteCourse(course)}
                                            >
                                                Excluir
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                                {!isLoading && courses.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="text-center text-secondary py-4">
                                            Nenhum curso cadastrado ainda.
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
