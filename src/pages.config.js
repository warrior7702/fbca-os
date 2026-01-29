/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import AIHelper from './pages/AIHelper';
import Achievements from './pages/Achievements';
import AdminSetup from './pages/AdminSetup';
import AkitaBoxExplorer from './pages/AkitaBoxExplorer';
import AkitaFetch from './pages/AkitaFetch';
import AkitaSyncAdmin from './pages/AkitaSyncAdmin';
import Approvals from './pages/Approvals';
import ApprovalsDebug from './pages/ApprovalsDebug';
import AssignmentRules from './pages/AssignmentRules';
import BackfillEventCodes from './pages/BackfillEventCodes';
import BookableRoomsAdmin from './pages/BookableRoomsAdmin';
import BrandAssets from './pages/BrandAssets';
import Buildings from './pages/Buildings';
import Calendar from './pages/Calendar';
import CampaignRunning from './pages/CampaignRunning';
import ClaimTicket from './pages/ClaimTicket';
import CommunicationsRequestForm from './pages/CommunicationsRequestForm';
import CreateTicket from './pages/CreateTicket';
import CronStatus from './pages/CronStatus';
import Dashboard from './pages/Dashboard';
import DepartmentTest from './pages/DepartmentTest';
import DiagnoseMysteryResource from './pages/DiagnoseMysteryResource';
import Documents from './pages/Documents';
import EmailTemplateEditor from './pages/EmailTemplateEditor';
import EventOpsDetail from './pages/EventOpsDetail';
import FBCANexts from './pages/FBCANexts';
import FloorPlanManager from './pages/FloorPlanManager';
import FoodService from './pages/FoodService';
import Home from './pages/Home';
import ImportCardholders from './pages/ImportCardholders';
import ImportClickUpTickets from './pages/ImportClickUpTickets';
import ImportTickets from './pages/ImportTickets';
import InboxHelper from './pages/InboxHelper';
import IntegrationTest from './pages/IntegrationTest';
import Knowledgebase from './pages/Knowledgebase';
import Loading from './pages/Loading';
import Marketing from './pages/Marketing';
import Me from './pages/Me';
import MediaPlayer from './pages/MediaPlayer';
import MeetingNotes from './pages/MeetingNotes';
import MicrosoftLogin from './pages/MicrosoftLogin';
import MyApprovals from './pages/MyApprovals';
import MyDepartment from './pages/MyDepartment';
import MyMeetings from './pages/MyMeetings';
import MyTasks from './pages/MyTasks';
import NormalizeUserNames from './pages/NormalizeUserNames';
import Notifications from './pages/Notifications';
import Onboarding from './pages/Onboarding';
import PCOAPITester from './pages/PCOAPITester';
import PCODebug from './pages/PCODebug';
import PhantomUserHunter from './pages/PhantomUserHunter';
import ProjectReview from './pages/ProjectReview';
import RoleManagement from './pages/RoleManagement';
import Search from './pages/Search';
import Settings from './pages/Settings';
import SharePoint from './pages/SharePoint';
import StaffDirectory from './pages/StaffDirectory';
import SupportTickets from './pages/SupportTickets';
import TaskDetail from './pages/TaskDetail';
import Tasks from './pages/Tasks';
import TestCardholders from './pages/TestCardholders';
import TestMysterySync from './pages/TestMysterySync';
import TestTranscription from './pages/TestTranscription';
import TicketAnalytics from './pages/TicketAnalytics';
import TicketDetail from './pages/TicketDetail';
import TicketReporting from './pages/TicketReporting';
import TicketRoleVerification from './pages/TicketRoleVerification';
import Ticketing from './pages/Ticketing';
import VoiceProfiles from './pages/VoiceProfiles';
import WorkflowDetail from './pages/WorkflowDetail';
import WorkflowHub from './pages/WorkflowHub';
import index from './pages/index';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AIHelper": AIHelper,
    "Achievements": Achievements,
    "AdminSetup": AdminSetup,
    "AkitaBoxExplorer": AkitaBoxExplorer,
    "AkitaFetch": AkitaFetch,
    "AkitaSyncAdmin": AkitaSyncAdmin,
    "Approvals": Approvals,
    "ApprovalsDebug": ApprovalsDebug,
    "AssignmentRules": AssignmentRules,
    "BackfillEventCodes": BackfillEventCodes,
    "BookableRoomsAdmin": BookableRoomsAdmin,
    "BrandAssets": BrandAssets,
    "Buildings": Buildings,
    "Calendar": Calendar,
    "CampaignRunning": CampaignRunning,
    "ClaimTicket": ClaimTicket,
    "CommunicationsRequestForm": CommunicationsRequestForm,
    "CreateTicket": CreateTicket,
    "CronStatus": CronStatus,
    "Dashboard": Dashboard,
    "DepartmentTest": DepartmentTest,
    "DiagnoseMysteryResource": DiagnoseMysteryResource,
    "Documents": Documents,
    "EmailTemplateEditor": EmailTemplateEditor,
    "EventOpsDetail": EventOpsDetail,
    "FBCANexts": FBCANexts,
    "FloorPlanManager": FloorPlanManager,
    "FoodService": FoodService,
    "Home": Home,
    "ImportCardholders": ImportCardholders,
    "ImportClickUpTickets": ImportClickUpTickets,
    "ImportTickets": ImportTickets,
    "InboxHelper": InboxHelper,
    "IntegrationTest": IntegrationTest,
    "Knowledgebase": Knowledgebase,
    "Loading": Loading,
    "Marketing": Marketing,
    "Me": Me,
    "MediaPlayer": MediaPlayer,
    "MeetingNotes": MeetingNotes,
    "MicrosoftLogin": MicrosoftLogin,
    "MyApprovals": MyApprovals,
    "MyDepartment": MyDepartment,
    "MyMeetings": MyMeetings,
    "MyTasks": MyTasks,
    "NormalizeUserNames": NormalizeUserNames,
    "Notifications": Notifications,
    "Onboarding": Onboarding,
    "PCOAPITester": PCOAPITester,
    "PCODebug": PCODebug,
    "PhantomUserHunter": PhantomUserHunter,
    "ProjectReview": ProjectReview,
    "RoleManagement": RoleManagement,
    "Search": Search,
    "Settings": Settings,
    "SharePoint": SharePoint,
    "StaffDirectory": StaffDirectory,
    "SupportTickets": SupportTickets,
    "TaskDetail": TaskDetail,
    "Tasks": Tasks,
    "TestCardholders": TestCardholders,
    "TestMysterySync": TestMysterySync,
    "TestTranscription": TestTranscription,
    "TicketAnalytics": TicketAnalytics,
    "TicketDetail": TicketDetail,
    "TicketReporting": TicketReporting,
    "TicketRoleVerification": TicketRoleVerification,
    "Ticketing": Ticketing,
    "VoiceProfiles": VoiceProfiles,
    "WorkflowDetail": WorkflowDetail,
    "WorkflowHub": WorkflowHub,
    "index": index,
}

export const pagesConfig = {
    mainPage: "Loading",
    Pages: PAGES,
    Layout: __Layout,
};