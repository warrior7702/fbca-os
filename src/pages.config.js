import Loading from './pages/Loading';
import Dashboard from './pages/Dashboard';
import Marketing from './pages/Marketing';
import FoodService from './pages/FoodService';
import FBCANexts from './pages/FBCANexts';
import Layout from './Layout.jsx';


export const PAGES = {
    "Loading": Loading,
    "Dashboard": Dashboard,
    "Marketing": Marketing,
    "FoodService": FoodService,
    "FBCANexts": FBCANexts,
}

export const pagesConfig = {
    mainPage: "Loading",
    Pages: PAGES,
    Layout: Layout,
};