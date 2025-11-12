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
import MyTasks from './pages/MyTasks';
import AIHelper from './pages/AIHelper';
import MyApprovals from './pages/MyApprovals';
import TaskDetail from './pages/TaskDetail';
import BrandAssets from './pages/BrandAssets';
import Ticketing from './pages/Ticketing';
import MyDepartment from './pages/MyDepartment';
import InboxHelper from './pages/InboxHelper';
import MyMeetings from './pages/MyMeetings';
import PCODebug from './pages/PCODebug';
import index from './pages/index';
import ImportCardholders from './pages/ImportCardholders';
import TestCardholders from './pages/TestCardholders';
import AdminSetup from './pages/AdminSetup';
import Calendar from './pages/Calendar';
import SupportTickets from './pages/SupportTickets';
import CreateTicket from './pages/CreateTicket';
import PCOAPITester from './pages/PCOAPITester';
import PhantomUserHunter from './pages/PhantomUserHunter';
import WorkflowHub from './pages/WorkflowHub';
import TestMysterySync from './pages/TestMysterySync';
import CommunicationsRequestForm from './pages/CommunicationsRequestForm';
import WorkflowDetail from './pages/WorkflowDetail';
import ProjectReview from './pages/ProjectReview';
import DiagnoseMysteryResource from './pages/DiagnoseMysteryResource';
import CronStatus from './pages/CronStatus';
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
    "MyTasks": MyTasks,
    "AIHelper": AIHelper,
    "MyApprovals": MyApprovals,
    "TaskDetail": TaskDetail,
    "BrandAssets": BrandAssets,
    "Ticketing": Ticketing,
    "MyDepartment": MyDepartment,
    "InboxHelper": InboxHelper,
    "MyMeetings": MyMeetings,
    "PCODebug": PCODebug,
    "index": index,
    "ImportCardholders": ImportCardholders,
    "TestCardholders": TestCardholders,
    "AdminSetup": AdminSetup,
    "Calendar": Calendar,
    "SupportTickets": SupportTickets,
    "CreateTicket": CreateTicket,
    "PCOAPITester": PCOAPITester,
    "PhantomUserHunter": PhantomUserHunter,
    "WorkflowHub": WorkflowHub,
    "TestMysterySync": TestMysterySync,
    "CommunicationsRequestForm": CommunicationsRequestForm,
    "WorkflowDetail": WorkflowDetail,
    "ProjectReview": ProjectReview,
    "DiagnoseMysteryResource": DiagnoseMysteryResource,
    "CronStatus": CronStatus,
}

export const pagesConfig = {
    mainPage: "Loading",
    Pages: PAGES,
    Layout: Layout,
};