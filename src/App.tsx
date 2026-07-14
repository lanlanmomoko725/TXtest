import { Routes, Route, Outlet } from 'react-router'
import Home from './pages/Home'
import Login from "./pages/Login"
import Register from "./pages/Register"
import NotFound from "./pages/NotFound"
import CategoryPage from "./pages/Category"
import PostDetail from "./pages/PostDetail"
import CreatePost from "./pages/CreatePost"
import Profile from "./pages/Profile"
import AccountInfo from "./pages/AccountInfo"
import AccountRecovery from "./pages/AccountRecovery"
import Featured from "./pages/Featured"
import WeeklySky from "./pages/WeeklySky"
import Activities from "./pages/Activities"
import CreateActivity from "./pages/CreateActivity"
import ActivityDetail from "./pages/ActivityDetail"
import SkyExplanation from "./pages/SkyExplanation"
import SkyEvents from "./pages/SkyEvents"
import SkyGallery from "./pages/SkyGallery"
import AboutUs from "./pages/AboutUs"
import JoinUs from "./pages/JoinUs"
import PrivacyPolicy from "./pages/legal/PrivacyPolicy"
import UserAgreement from "./pages/legal/UserAgreement"
import TagPosts from "./pages/TagPosts"
import SearchPage from "./pages/Search"
import AdminUsers from "./pages/admin/Users"
import AdminAuditLogs from "./pages/admin/AuditLogs"
import AdminProfileReviews from "./pages/admin/ProfileReviews"
import AdminCommentReviews from "./pages/admin/CommentReviews"
import AdminRecoveryReviews from "./pages/admin/RecoveryReviews"
import Navbar from "./components/Navbar"
import Footer from "./components/Footer"
import ScrollManager from "./components/ScrollManager"
import { LogoEasterEggProvider } from "./components/LogoEasterEgg"

function Layout() {
  return (
    <LogoEasterEggProvider>
      <div className="min-h-screen flex flex-col bg-background transition-colors duration-300">
        <ScrollManager />
        <Navbar />
        <main className="flex-1">
          <Outlet />
        </main>
        <Footer />
      </div>
    </LogoEasterEggProvider>
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
        <Route path="/account" element={<AccountInfo />} />
        <Route path="/featured" element={<Featured />} />
        <Route path="/weekly-sky" element={<WeeklySky />} />
        <Route path="/sky-events" element={<SkyEvents />} />
        <Route path="/activities" element={<Activities />} />
        <Route path="/activities/new" element={<CreateActivity />} />
        <Route path="/activities/detail/:id" element={<ActivityDetail />} />
        <Route path="/activities/:year/:month" element={<Activities />} />
        <Route path="/sky-gallery" element={<SkyGallery />} />
        <Route path="/sky-explanation" element={<SkyExplanation />} />
        <Route path="/about" element={<AboutUs />} />
        <Route path="/join-us" element={<JoinUs />} />
        <Route path="/user-agreement" element={<UserAgreement />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/tag/:tag" element={<TagPosts />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/admin/users" element={<AdminUsers />} />
        <Route path="/admin/profile-reviews" element={<AdminProfileReviews />} />
        <Route path="/admin/comment-reviews" element={<AdminCommentReviews />} />
        <Route path="/admin/recovery-reviews" element={<AdminRecoveryReviews />} />
        <Route path="/admin/audit" element={<AdminAuditLogs />} />
      </Route>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/account-recovery" element={<AccountRecovery />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
