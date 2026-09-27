import { BrowserRouter, Route, Routes } from "react-router-dom"
import Home from "./Home"
import BookList from "./pages/books/BookList"
import CourseList from "./pages/courses/CourseList"
import StudentList from "./pages/students/StudentList"

export default function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/books" element={<BookList />} />
                <Route path="/students" element={<StudentList />} />
                <Route path="/courses" element={<CourseList />} />
            </Routes>
        </BrowserRouter>
    )
}
