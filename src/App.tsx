import { Routes, Route, Outlet } from 'react-router'
import Home from './pages/Home'
import Login from "./pages/Login"
import Register from "./pages/Register"
import NotFound from "./pages/NotFound"
import CategoryPage from "./pages/Category"
import PostDetail from "./pages/PostDetail"
import CreatePost from "./pages/CreatePost"
import Profile from "./pages/Profile"
import Featured from "./pages/Featured"
import WeeklySky from "./pages/WeeklySky"
import SkyExplanation from "./pages/SkyExplanation"
import SkyEvents from "./pages/SkyEvents"
import SkyGallery from "./pages/SkyGallery"
import AboutUs from "./pages/AboutUs"
import TagPosts from "./pages/TagPosts"
import AdminUsers from "./pages/admin/Users"
import AdminAuditLogs from "./pages/admin/AuditLogs"
import Navbar from "./components/Navbar"
import Footer from "./components/Footer"
import ScrollManager from "./components/ScrollManager"

function Layout() {
  return (
    <div className="min-h-screen flex flex-col bg-background transition-colors duration-300">
      <ScrollManager />
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/category/:categoryId" element={<CategoryPage />} />
        <Route path="/region/:regionId" element={<CategoryPage />} />
        <Route path="/post/:id" element={<PostDetail />} />
        <Route path="/create" element={<CreatePost />} />
        <Route path="/profile/:id" element={<Profile />} />
        <Route path="/featured" element={<Featured />} />
        <Route path="/weekly-sky" element={<WeeklySky />} />
        <Route path="/sky-events" element={<SkyEvents />} />
        <Route path="/sky-gallery" element={<SkyGallery />} />
        <Route path="/sky-explanation" element={<SkyExplanation />} />
        <Route path="/about" element={<AboutUs />} />
        <Route path="/tag/:tag" element={<TagPosts />} />
        <Route path="/admin/users" element={<AdminUsers />} />
        <Route path="/admin/audit" element={<AdminAuditLogs />} />
      </Route>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
