import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface Course {
  id: string;
  title: string;
  description: string | null;
  vimeo_url: string;
}

const Course = () => {
  const { id } = useParams<{ id: string }>();
  const [course, setCourse] = useState<Course | null>(null);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkUser();
    if (id) {
      fetchCourse();
    }
  }, [id]);

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  const fetchCourse = async () => {
    try {
      const { data: courseData, error: courseError } = await supabase
        .from("courses")
        .select("*")
        .eq("id", id)
        .single();

      if (courseError) throw courseError;

      if (!courseData) {
        toast({
          title: "Error",
          description: "Course not found",
          variant: "destructive",
        });
        navigate("/dashboard");
        return;
      }

      const { data: enrollmentData, error: enrollmentError } = await supabase
        .from("enrollments")
        .select("progress")
        .eq("course_id", id)
        .maybeSingle();

      if (enrollmentError) throw enrollmentError;

      setCourse(courseData);
      setProgress(enrollmentData?.progress || 0);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const updateProgress = async (newProgress: number) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        toast({
          title: "Error",
          description: "You must be logged in to update progress",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from("enrollments")
        .update({ progress: newProgress })
        .eq("course_id", id)
        .eq("user_id", session.user.id);

      if (error) throw error;
      
      setProgress(newProgress);
      toast({
        title: "Success",
        description: "Progress updated successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Course not found</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Button
        variant="outline"
        className="mb-4"
        onClick={() => navigate("/dashboard")}
      >
        Back to Dashboard
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>{course.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="aspect-video mb-4">
            <iframe
              src={course.vimeo_url}
              className="w-full h-full"
              frameBorder="0"
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
            />
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">Course Progress</h3>
              <Progress value={progress} className="mb-2" />
              <div className="flex justify-between text-sm text-gray-600">
                <span>{progress}% Complete</span>
                <button
                  onClick={() => updateProgress(Math.min(progress + 10, 100))}
                  className="text-blue-600 hover:underline"
                >
                  Mark Progress
                </button>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-2">About this Course</h3>
              <p className="text-gray-600">{course.description}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Course;