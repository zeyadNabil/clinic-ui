import { Routes } from "@angular/router";
import { Login } from "./login/login";
import { Register } from "./register/register";
import { authRedirectGuard } from "../guards/auth-redirect.guard";

export const AUTH_ROUTES : Routes = [
  {path:'',redirectTo:'login',pathMatch:'full'},
  {
    path:'login',
    component:Login,
    canActivate: [authRedirectGuard]
  },
  {
    path:'register',
    component:Register,
    canActivate: [authRedirectGuard]
  },
]
