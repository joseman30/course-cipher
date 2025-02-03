import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp, CheckCircle2 } from "lucide-react";

interface Course {
  id: string;
  title: string;
  description: string;
  thumbnail_url: string;
  vimeo_url: string;
  sections?: CourseSection[];
}

interface CourseSection {
  id: string;
  title: string;
  description: string | null;
  order_index: number;
  completed?: boolean;
}

interface Enrollment {
  course_id: string;
  progress: number;
}

const Dashboard = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkUser();
    fetchData();
  }, []);

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  const fetchData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      // Fetch courses with their sections
      const { data: coursesData, error: coursesError } = await supabase
        .from("courses")
        .select(`
          *,
          course_sections (
            id,
            title,
            description,
            order_index
          )
        `)
        .order('created_at');

      if (coursesError) throw coursesError;

      // Fetch enrollments and section completions
      const [enrollmentsResponse, completionsResponse] = await Promise.all([
        supabase
          .from("enrollments")
          .select("*")
          .eq("user_id", session.user.id),
        supabase
          .from("section_completions")
          .select("section_id")
          .eq("user_id", session.user.id)
      ]);

      if (enrollmentsResponse.error) throw enrollmentsResponse.error;
      if (completionsResponse.error) throw completionsResponse.error;

      // Process the data
      const completedSectionIds = new Set(
        completionsResponse.data.map(completion => completion.section_id)
      );

      const processedCourses = coursesData.map(course => ({
        ...course,
        sections: course.course_sections.map(section => ({
          ...section,
          completed: completedSectionIds.has(section.id)
        })).sort((a, b) => a.order_index - b.order_index)
      }));

      setCourses(processedCourses);
      setEnrollments(enrollmentsResponse.data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEnroll = async (courseId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        toast({
          title: "Error",
          description: "You must be logged in to enroll in a course",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from("enrollments")
        .insert({
          course_id: courseId,
          user_id: session.user.id,
        });

      if (error) throw error;

      toast({
        title: "Success!",
        description: "Successfully enrolled in the course.",
      });
      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const toggleSection = (courseId: string) => {
    setOpenSections(prev => ({
      ...prev,
      [courseId]: !prev[courseId]
    }));
  };

  const markSectionComplete = async (sectionId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const { error } = await supabase
        .from("section_completions")
        .insert({
          user_id: session.user.id,
          section_id: sectionId,
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Section marked as complete",
      });
      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const isEnrolled = (courseId: string) => {
    return enrollments.some((e) => e.course_id === courseId);
  };

  const getProgress = (course: Course) => {
    if (!course.sections?.length) return 0;
    const completedSections = course.sections.filter(section => section.completed).length;
    return Math.round((completedSections / course.sections.length) * 100);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">My Courses</h1>
        <Button
          variant="outline"
          onClick={async () => {
            await supabase.auth.signOut();
            navigate("/auth");
          }}
        >
          Sign Out
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {courses.map((course) => (
          <Card key={course.id}>
            <img
              src={course.thumbnail_url}
              alt={course.title}
              className="w-full h-48 object-cover rounded-t-lg"
            />
            <CardHeader>
              <CardTitle>{course.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">{course.description}</p>
              {isEnrolled(course.id) ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Progress</span>
                      <span>{getProgress(course)}%</span>
                    </div>
                    <Progress value={getProgress(course)} />
                  </div>

                  <Collapsible
                    open={openSections[course.id]}
                    onOpenChange={() => toggleSection(course.id)}
                    className="space-y-2"
                  >
                    <CollapsibleTrigger className="flex items-center justify-between w-full p-2 text-sm font-medium text-left hover:bg-gray-100 rounded-md">
                      <span>Course Sections</span>
                      {openSections[course.id] ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-2">
                      {course.sections?.map((section) => (
                        <div
                          key={section.id}
                          className="flex items-center justify-between p-2 text-sm border rounded-md"
                        >
                          <div className="flex-1">
                            <p className="font-medium">{section.title}</p>
                            {section.description && (
                              <p className="text-gray-600 text-xs mt-1">
                                {section.description}
                              </p>
                            )}
                          </div>
                          {section.completed ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => markSectionComplete(section.id)}
                            >
                              Mark Complete
                            </Button>
                          )}
                        </div>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>

                  <Button
                    className="w-full"
                    onClick={() => navigate(`/course/${course.id}`)}
                  >
                    Continue Learning
                  </Button>
                </div>
              ) : (
                <Button
                  className="w-full"
                  onClick={() => handleEnroll(course.id)}
                >
                  Enroll Now
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;