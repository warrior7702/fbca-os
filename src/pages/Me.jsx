import React from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckSquare, Calendar, Video, Maximize2, FileText, CheckCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format, addDays, startOfWeek, isSameDay, isToday, startOfDay } from "date-fns";
import FullMonthCalendar from "../components/me/FullMonthCalendar";

export default function Me() {
  const [user, setUser] = React.useState(null);
  const [myTasks, setMyTasks] = React.useState([]);
  const [pendingApprovals, setPendingApprovals] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [showFullMonth, setShowFullMonth] = React.useState(false);
  const currentWeekRef = React.useRef(null);
  const calendarContainerRef = React.useRef(null);

  React.useEffect(() => {
    loadData();
  }, []);

  React.useEffect(() => {
    if (!loading && currentWeekRef.current && calendarContainerRef.current) {
      const container = calendarContainerRef.current;
      const weekElement = currentWeekRef.current;
      const offsetTop = weekElement.offsetTop - container.offsetTop;
      container.scrollTo({ top: offsetTop, behavior: 'smooth' });
    }
  }, [loading]);

  const loadData = async () => {
    setLoading(true);
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      try {
        const tasks = await base44.entities.Task.filter({ assignee: currentUser.email }, 'due_at', 100);
        setMyTasks(tasks);
      } catch (e) {
        console.log("No tasks yet:", e);
        setMyTasks([]);
      }

      try {
        const { data } = await base44.functions.invoke('getMyPendingApprovals');
        setPendingApprovals(data.pending_approvals || []);
      } catch (e) {
        console.log("Could not fetch approvals:", e);
        setPendingApprovals([]);
      }

    } catch (error) {
      console.error("Error loading data:", error);
    }
    setLoading(false);
  };

  const scrollToToday = () => {
    if (currentWeekRef.current && calendarContainerRef.current) {
      const container = calendarContainerRef.current;
      const weekElement = currentWeekRef.current;
      const offsetTop = weekElement.offsetTop - container.offsetTop;
      container.scrollTo({ top: offsetTop, behavior: 'smooth' });
    }
  };

  const generateMultipleWeeks = () => {
    const weeks = [];
    const today = new Date();
    for (let weekNum = -2; weekNum < 6; weekNum++) {
      const baseDate = addDays(today, weekNum * 7);
      const weekStart = startOfWeek(baseDate, { weekStartsOn: 0 });
      const days = [];
      for (let i = 0; i < 7; i++) {
        days.push(addDays(weekStart, i));
      }
      weeks.push({
        days,
        isCurrentWeek: weekNum === 0
      });
    }
    return weeks;
  };

  const allWeeks = generateMultipleWeeks();

  const tasksByDate = {};
  myTasks.forEach((task) => {
    if (task.due_at) {
      const dateKey = format(startOfDay(new Date(task.due_at)), 'yyyy-MM-dd');
      if (!tasksByDate[dateKey]) {
        tasksByDate[dateKey] = [];
      }
      tasksByDate[dateKey].push(task);
    }
  });

  const todayTasks = myTasks.filter((t) =>
    t.due_at && isSameDay(new Date(t.due_at), new Date())
  );

  const getTaskStatusColor = (status) => {
    const colors = {
      'Todo': 'bg-gray-100 text-gray-800',
      'In_Progress': 'bg-blue-100 text-blue-800',
      'Blocked': 'bg-red-100 text-red-800',
      'Done': 'bg-green-100 text-green-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  const displayName = user?.display_name || user?.full_name;

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Welcome, {displayName}</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Today's Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              <Link to={createPageUrl('Tasks')} className="block">
                <div className="hover:bg-gray-50 rounded-lg p-4 transition-colors cursor-pointer">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckSquare className="w-5 h-5 text-blue-600" />
                    <h3 className="font-semibold text-gray-900">My Tasks Today</h3>
                    <Badge variant="secondary" className="ml-auto">{todayTasks.length}</Badge>
                  </div>
                  {todayTasks.length === 0 ? (
                    <p className="text-sm text-gray-500">No tasks due today</p>
                  ) : (
                    <div className="space-y-2">
                      {todayTasks.slice(0, 3).map((task) => (
                        <div key={task.id} className="flex items-center justify-between text-sm">
                          <span className="text-gray-700 truncate flex-1">{task.title}</span>
                          <Badge className={`${getTaskStatusColor(task.status)} ml-2 text-xs`}>
                            {task.status}
                          </Badge>
                        </div>
                      ))}
                      {todayTasks.length > 3 && (
                        <p className="text-xs text-blue-600">+{todayTasks.length - 3} more</p>
                      )}
                    </div>
                  )}
                </div>
              </Link>

              <Link to={createPageUrl('Approvals')} className="block">
                <div className="hover:bg-gray-50 rounded-lg p-4 transition-colors cursor-pointer">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle className="w-5 h-5 text-orange-600" />
                    <h3 className="font-semibold text-gray-900">Pending Approvals</h3>
                    <Badge variant="secondary" className="ml-auto">{pendingApprovals.length}</Badge>
                  </div>
                  {pendingApprovals.length === 0 ? (
                    <p className="text-sm text-gray-500">No pending approvals</p>
                  ) : (
                    <div className="space-y-2">
                      {pendingApprovals.slice(0, 3).map((approval, idx) => (
                        <div key={idx} className="text-sm">
                          <p className="text-gray-700 font-medium truncate">{approval.event_name}</p>
                          <p className="text-xs text-gray-500 truncate">{approval.resource_name}</p>
                        </div>
                      ))}
                      {pendingApprovals.length > 3 && (
                        <p className="text-xs text-orange-600">+{pendingApprovals.length - 3} more</p>
                      )}
                    </div>
                  )}
                </div>
              </Link>

              <div className="hover:bg-gray-50 rounded-lg p-4 transition-colors">
                <div className="flex items-center gap-2 mb-3">
                  <Video className="w-5 h-5 text-green-600" />
                  <h3 className="font-semibold text-gray-900">Today's Meetings</h3>
                  <Badge variant="secondary" className="ml-auto">0</Badge>
                </div>
                <div className="flex items-center justify-center py-4">
                  <Button variant="outline" size="sm">Connect Calendar</Button>
                </div>
              </div>

            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>My Tasks</CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={scrollToToday}>
                  Today
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowFullMonth(true)}>
                  <Maximize2 className="w-4 h-4 mr-2" />
                  Pop out full month
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div 
              ref={calendarContainerRef}
              className="overflow-y-auto max-h-[600px] border rounded-lg"
            >
              {allWeeks.map((week, weekIdx) => (
                <div
                  key={weekIdx}
                  ref={week.isCurrentWeek ? currentWeekRef : null}
                  className={`border-b last:border-b-0 ${week.isCurrentWeek ? 'bg-indigo-50' : 'bg-white'}`}
                >
                  <div className="grid grid-cols-7">
                    {week.days.map((day, dayIdx) => {
                      const dateKey = format(day, 'yyyy-MM-dd');
                      const dayTasks = tasksByDate[dateKey] || [];
                      const isTodayDate = isToday(day);

                      return (
                        <div
                          key={dayIdx}
                          className={`min-h-[120px] p-3 border-r last:border-r-0 ${
                            isTodayDate ? 'bg-indigo-100' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className={`text-sm font-semibold ${
                              isTodayDate ? 'text-indigo-600' : 'text-gray-900'
                            }`}>
                              {format(day, 'EEE d')}
                            </div>
                            {isTodayDate && (
                              <Badge className="bg-indigo-600 text-[10px] px-1.5 py-0">Today</Badge>
                            )}
                          </div>

                          <div className="space-y-1.5">
                            {dayTasks.map((task, taskIdx) => (
                              <div
                                key={taskIdx}
                                className="text-xs p-2 rounded bg-white border border-gray-200 hover:shadow-sm transition-shadow cursor-pointer"
                              >
                                <Badge className={`${getTaskStatusColor(task.status)} text-[10px] px-1 py-0 mb-1`}>
                                  {task.status}
                                </Badge>
                                <div className="font-medium text-gray-900 line-clamp-2">
                                  {task.title}
                                </div>
                                {task.due_at && (
                                  <div className="text-[10px] text-gray-500 mt-1">
                                    {format(new Date(task.due_at), 'h:mm a')}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

      </div>

      <FullMonthCalendar
        open={showFullMonth}
        onOpenChange={setShowFullMonth}
        tasks={myTasks}
      />
    </div>
  );
}