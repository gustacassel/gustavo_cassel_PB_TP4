import { useEffect, useState } from "react"
import { Badge, Card, Col, Container, Nav, Navbar, Row, Spinner } from "react-bootstrap"
import { Link } from "react-router-dom"
import "./Home.css"
import { getBooks } from "./services/books-api"
import { getCourses } from "./services/courses-api"
import { getStudentsIntegrationHealth } from "./services/integration-api"
import { getStudents } from "./services/students-api"

export default function Home() {
    const [bookCount, setBookCount] = useState<number | null>(null)
    const [studentCount, setStudentCount] = useState<number | null>(null)
    const [courseCount, setCourseCount] = useState<number | null>(null)
    const [isIntegrationUp, setIsIntegrationUp] = useState<boolean | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        let isMounted = true

        const loadCounts = async () => {
            try {
                setIsLoading(true)
                // allSettled: se o microsserviço estiver fora do ar, o painel
                // ainda mostra os dados da biblioteca em vez de zerar tudo.
                const [books, students, courses, health] = await Promise.allSettled([
                    getBooks(),
                    getStudents(),
                    getCourses(),
                    getStudentsIntegrationHealth(),
                ])

                if (!isMounted) {
                    return
                }

                setBookCount(books.status === "fulfilled" ? books.value.length : null)
                setStudentCount(students.status === "fulfilled" ? students.value.length : null)
                setCourseCount(courses.status === "fulfilled" ? courses.value.length : null)
                setIsIntegrationUp(health.status === "fulfilled" ? health.value.reachable : false)
            } finally {
                if (isMounted) {
                    setIsLoading(false)
                }
            }
        }

        loadCounts()

        return () => {
            isMounted = false
        }
    }, [])

    const metric = (value: number | null) => {
        if (isLoading) {
            return <Spinner animation="border" size="sm" />
        }
        return value ?? "-"
    }

    return (
        <div className="home-page">
            <Navbar expand="lg" className="py-3" bg="body">
                <Container>
                    <Navbar.Brand className="d-flex align-items-center gap-2">
                        <i className="bi bi-book-half fs-4" />
                        Biblioteca Aurora
                    </Navbar.Brand>
                    <Navbar.Toggle aria-controls="main-nav" />
                    <Navbar.Collapse id="main-nav">
                        <Nav className="ms-auto align-items-lg-center gap-3">
                            <Link to="/books" className="nav-shortcut">
                                Livros
                            </Link>
                            <Link to="/students" className="nav-shortcut">
                                Estudantes
                            </Link>
                            <Link to="/courses" className="nav-shortcut">
                                Cursos
                            </Link>
                        </Nav>
                    </Navbar.Collapse>
                </Container>
            </Navbar>

            <section className="hero-section py-5" id="overview">
                <Container>
                    <Row className="g-4 align-items-center">
                        <Col lg={6}>
                            <p className="eyebrow">Painel principal</p>
                            <h1 className="display-5 fw-semibold mb-3">Gestão simples para livros e estudantes</h1>
                            <h3 className="fw-normal text-muted">TP3 de Projeto de Bloco</h3>
                            <p className="lead text-secondary mb-4">
                                O cadastro de estudantes e cursos foi extraído para um microsserviço próprio; a
                                biblioteca consome esses dados via Spring Cloud OpenFeign.
                            </p>
                            <div className="d-flex flex-wrap gap-3">
                                <Link to="/books" className="btn btn-primary btn-lg">
                                    Acessar livros
                                </Link>
                                <Link to="/students" className="btn btn-outline-primary btn-lg">
                                    Acessar estudantes
                                </Link>
                                <Link to="/courses" className="btn btn-outline-primary btn-lg">
                                    Acessar cursos
                                </Link>
                            </div>
                        </Col>
                        <Col lg={6}>
                            <Card className="shadow-sm border-0 hero-card">
                                <Card.Body>
                                    <div className="d-flex justify-content-between align-items-center mb-3">
                                        <h5 className="mb-0">Resumo rápido</h5>
                                        {isLoading ? (
                                            <Spinner animation="border" size="sm" />
                                        ) : (
                                            <Badge bg={isIntegrationUp ? "success" : "danger"}>
                                                <i
                                                    className={`bi ${
                                                        isIntegrationUp ? "bi-diagram-3" : "bi-plug"
                                                    } me-1`}
                                                />
                                                students-api {isIntegrationUp ? "online" : "offline"}
                                            </Badge>
                                        )}
                                    </div>
                                    <Row className="g-3">
                                        <Col md={4}>
                                            <Card className="border-0 stats-card">
                                                <Card.Body>
                                                    <p className="text-secondary mb-1">Livros</p>
                                                    <h3 className="mb-0">{metric(bookCount)}</h3>
                                                </Card.Body>
                                            </Card>
                                        </Col>
                                        <Col md={4}>
                                            <Card className="border-0 stats-card">
                                                <Card.Body>
                                                    <p className="text-secondary mb-1">Estudantes</p>
                                                    <h3 className="mb-0">{metric(studentCount)}</h3>
                                                </Card.Body>
                                            </Card>
                                        </Col>
                                        <Col md={4}>
                                            <Card className="border-0 stats-card">
                                                <Card.Body>
                                                    <p className="text-secondary mb-1">Cursos</p>
                                                    <h3 className="mb-0">{metric(courseCount)}</h3>
                                                </Card.Body>
                                            </Card>
                                        </Col>
                                    </Row>
                                    {!isLoading && !isIntegrationUp && (
                                        <p className="text-danger small mb-0 mt-3">
                                            A library-api não está conseguindo falar com o microsserviço. Suba o
                                            students-api em <code>http://localhost:8081</code>.
                                        </p>
                                    )}
                                </Card.Body>
                            </Card>
                        </Col>
                    </Row>
                </Container>
            </section>

            <section className="py-5 bg-body-tertiary" id="shortcuts">
                <Container>
                    <Row className="g-4">
                        {[
                            {
                                icon: "bi bi-journal-text",
                                title: "Catálogo de livros",
                                text: "Cadastre, edite e exclua títulos com rapidez.",
                                action: "Abrir livros",
                                link: "/books",
                                origin: "library-api :8080",
                            },
                            {
                                icon: "bi bi-person-vcard",
                                title: "Registro de estudantes",
                                text: "Alunos, situação acadêmica e curso de cada um.",
                                action: "Abrir estudantes",
                                link: "/students",
                                origin: "students-api :8081",
                            },
                            {
                                icon: "bi bi-mortarboard",
                                title: "Catálogo de cursos",
                                text: "Cursos oferecidos e quantos alunos ativos cada um tem.",
                                action: "Abrir cursos",
                                link: "/courses",
                                origin: "students-api :8081",
                            },
                        ].map((item) => (
                            <Col md={4} key={item.title}>
                                <Card className="h-100 border-0 shadow-sm shortcut-card">
                                    <Card.Body>
                                        <div className="shortcut-icon">
                                            <i className={item.icon} />
                                        </div>
                                        <h5 className="mt-3">{item.title}</h5>
                                        <p className="text-secondary mb-2">{item.text}</p>
                                        <p className="small text-secondary mb-4">
                                            <i className="bi bi-hdd-network me-1" />
                                            {item.origin}
                                        </p>
                                        <Link to={item.link} className="btn btn-outline-primary">
                                            {item.action}
                                        </Link>
                                    </Card.Body>
                                </Card>
                            </Col>
                        ))}
                    </Row>
                </Container>
            </section>

            <footer className="py-4 border-top">
                <Container className="d-flex flex-column flex-md-row align-items-center justify-content-between gap-3">
                    <div className="d-flex align-items-center gap-2">
                        <i className="bi bi-bookmark-heart" />
                        <span>Biblioteca Aurora © 2026</span>
                    </div>
                </Container>
            </footer>
        </div>
    )
}
