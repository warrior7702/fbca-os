import Loading from './pages/Loading';
import Dashboard from './pages/Dashboard';
import Marketing from './pages/Marketing';
import FoodService from './pages/FoodService';
import Settings from './pages/Settings';
import IntegrationTest from './pages/IntegrationTest';
import Documents from './pages/Documents';
import Search from './pages/Search';
import StaffDirectory from './pages/StaffDirectory';
import MicrosoftLogin from './pages/MicrosoftLogin';
import Onboarding from './pages/Onboarding';
import Me from './pages/Me';
import Tasks from './pages/Tasks';
import Approvals from './pages/Approvals';
import Layout from './Layout.jsx';


export const PAGES = {
    "Loading": Loading,
    "Dashboard": Dashboard,
    "Marketing": Marketing,
    "FoodService": FoodService,
    "Settings": Settings,
    "IntegrationTest": IntegrationTest,
    "Documents": Documents,
    "Search": Search,
    "StaffDirectory": StaffDirectory,
    "MicrosoftLogin": MicrosoftLogin,
    "Onboarding": Onboarding,
    "Me": Me,
    "Tasks": Tasks,
    "Approvals": Approvals,
}

export const pagesConfig = {
    mainPage: "Loading",
    Pages: PAGES,
    Layout: Layout,
};