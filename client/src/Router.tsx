import { Switch, Route } from "wouter";

import Landing from "@/pages/landing";
import AuthPage from "@/pages/AuthPage";
import SignInPage from "@/pages/sign-in";
import SignUpPage from "@/pages/sign-up";
import DashboardLayout from "@/pages/dashboard-layout";
import Projects from "@/pages/projects";
import ProjectDetails from "@/pages/project-details";
import MyProjects from "@/pages/my-projects";
import Profile from "@/pages/profile";
import MyApplications from "@/pages/my-applications";
import MySubmissions from "@/pages/my-submissions";
import NotFound from "@/pages/not-found";
import UserProfile from "@/pages/user-profile";

export default function Router() {
  return (
    <Switch>

      <Route path="/" component={Landing} />

      <Route path="/auth" component={AuthPage} />
      <Route path="/sign-in" component={SignInPage} />
      <Route path="/sign-in/:rest*" component={SignInPage} />
      <Route path="/sign-up" component={SignUpPage} />
      <Route path="/sign-up/:rest*" component={SignUpPage} />

      <Route path="/projects">
        {() => (
          <DashboardLayout>
            <Projects />
          </DashboardLayout>
        )}
      </Route>

      <Route path="/my-projects">
        {() => (
          <DashboardLayout>
            <MyProjects />
          </DashboardLayout>
        )}
      </Route>

      <Route path="/projects/:id">
        {() => (
          <DashboardLayout>
            <ProjectDetails />
          </DashboardLayout>
        )}
      </Route>

      <Route path="/profile">
        {() => (
          <DashboardLayout>
            <Profile />
          </DashboardLayout>
        )}
      </Route>

      <Route path="/users/:id">
        {() => (
          <DashboardLayout>
            <UserProfile />
          </DashboardLayout>
        )}
      </Route>

      <Route path="/applications">
        {() => (
          <DashboardLayout>
            <MyApplications />
          </DashboardLayout>
        )}
      </Route>

      <Route path="/submissions">
        {() => (
          <DashboardLayout>
            <MySubmissions />
          </DashboardLayout>
        )}
      </Route>

      <Route component={NotFound} />

    </Switch>
  );
}
