import { useEffect, useMemo, useState } from "react"
import { Button, Card, Col, Container, Row, Spinner, Table } from "react-bootstrap"
import { Link } from "react-router-dom"
import Swal from "sweetalert2"
import { createBook, deleteBook, getBooks, updateBook } from "../../services/books-api"
import type { Book } from "../../types/books"
import "../shared/ListPage.css"

export default function BookList() {
    const [books, setBooks] = useState<Book[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const totalBooks = books.length

    const uniqueAuthors = useMemo(() => {
        return new Set(books.map((book) => book.author)).size
    }, [books])

    useEffect(() => {
        let isMounted = true

        const loadBooks = async () => {
            try {
                setIsLoading(true)
                const data = await getBooks()
                if (isMounted) {
                    setBooks(data)
                    setError(null)
                }
            } catch (err) {
                if (isMounted) {
                    const message = err instanceof Error ? err.message : "Não foi possível carregar os livros."
                    setError(message)
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false)
                }
            }
        }

        loadBooks()

        return () => {
            isMounted = false
        }
    }, [])

    const reloadBooks = async () => {
        const data = await getBooks()
        setBooks(data)
    }

    const handleAddBook = async () => {
        const result = await Swal.fire({
            title: "Adicionar livro",
            html: `
                <input id="book-title" class="swal2-input" placeholder="Título">
                <input id="book-author" class="swal2-input" placeholder="Autor">
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: "Salvar",
            preConfirm: () => {
                const title = (document.getElementById("book-title") as HTMLInputElement | null)?.value.trim()
                const author = (document.getElementById("book-author") as HTMLInputElement | null)?.value.trim()
                if (!title || !author) {
                    Swal.showValidationMessage("Preencha título e autor.")
                    return null
                }
                return { title, author }
            },
        })

        if (!result.isConfirmed || !result.value) {
            return
        }

        try {
            await createBook(result.value)
            await reloadBooks()
            await Swal.fire("Salvo", "Livro cadastrado com sucesso.", "success")
        } catch (err) {
            const message = err instanceof Error ? err.message : "Não foi possível salvar o livro."
            await Swal.fire("Erro", message, "error")
        }
    }

    const handleEditBook = async (book: Book) => {
        const result = await Swal.fire({
            title: "Editar livro",
            html: `
                <input id="book-title" class="swal2-input" placeholder="Título" value="${book.title}">
                <input id="book-author" class="swal2-input" placeholder="Autor" value="${book.author}">
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: "Atualizar",
            preConfirm: () => {
                const title = (document.getElementById("book-title") as HTMLInputElement | null)?.value.trim()
                const author = (document.getElementById("book-author") as HTMLInputElement | null)?.value.trim()
                if (!title || !author) {
                    Swal.showValidationMessage("Preencha título e autor.")
                    return null
                }
                return { title, author }
            },
        })

        if (!result.isConfirmed || !result.value) {
            return
        }

        try {
            await updateBook(book.id, result.value)
            await reloadBooks()
            await Swal.fire("Atualizado", "Livro atualizado com sucesso.", "success")
        } catch (err) {
            const message = err instanceof Error ? err.message : "Não foi possível atualizar o livro."
            await Swal.fire("Erro", message, "error")
        }
    }

    const handleDeleteBook = async (book: Book) => {
        const result = await Swal.fire({
            title: "Remover livro?",
            text: `Isso vai excluir "${book.title}".`,
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Excluir",
        })

        if (!result.isConfirmed) {
            return
        }

        try {
            await deleteBook(book.id)
            await reloadBooks()
            await Swal.fire("Excluído", "Livro removido com sucesso.", "success")
        } catch (err) {
            const message = err instanceof Error ? err.message : "Não foi possível remover o livro."
            await Swal.fire("Erro", message, "error")
        }
    }
    return (
        <Container className="py-5 list-page">
            <div className="list-hero mb-4">
                <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
                    <div>
                        <p className="eyebrow">Catálogo</p>
                        <h1 className="mb-2">Livros</h1>
                        <p className="text-secondary mb-0">Acompanhe o acervo e atualize os títulos da biblioteca.</p>
                    </div>
                    <div className="d-flex gap-2 flex-wrap">
                        <Link to="/" className="btn btn-outline-secondary">
                            Voltar ao início
                        </Link>
                        <Button variant="primary" onClick={handleAddBook}>
                            <i className="bi bi-journal-plus me-2" />
                            Novo livro
                        </Button>
                    </div>
                </div>
            </div>

            <Row className="g-4 mb-4">
                {[
                    { label: "Total de títulos", value: totalBooks.toString() },
                    { label: "Autores únicos", value: uniqueAuthors.toString() },
                    { label: "Último título", value: books[0]?.title ?? "-" },
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
                        <h5 className="mb-0">Visão do catálogo</h5>
                        {isLoading ? (
                            <div className="d-flex align-items-center gap-2 text-secondary">
                                <Spinner animation="border" size="sm" />
                                Carregando
                            </div>
                        ) : (
                            <Button variant="outline-primary" size="sm" onClick={reloadBooks}>
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
                                    <th>Título</th>
                                    <th>Autor</th>
                                    <th>ID</th>
                                    <th className="text-end">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {books.map((book) => (
                                    <tr key={book.id}>
                                        <td>{book.title}</td>
                                        <td>{book.author}</td>
                                        <td>{book.id}</td>
                                        <td className="text-end">
                                            <Button
                                                variant="outline-secondary"
                                                size="sm"
                                                className="me-2"
                                                onClick={() => handleEditBook(book)}
                                            >
                                                Editar
                                            </Button>
                                            <Button variant="outline-danger" size="sm" onClick={() => handleDeleteBook(book)}>
                                                Excluir
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                                {!isLoading && books.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="text-center text-secondary py-4">
                                            Nenhum livro cadastrado ainda.
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
