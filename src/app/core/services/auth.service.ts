import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, tap } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthService {

  private readonly API = 'http://localhost:8080/auth';

  constructor(private http: HttpClient) {}

  register(data: {
    username: string;
    email: string;
    password: string;
  }): Observable<any> {
    return this.http.post(`${this.API}/signup`, data);
  }

  login(data: {
    email: string;
    password: string;
  }): Observable<{ token: string; expiresIn: number }> {
    return this.http.post<{ token: string; expiresIn: number }>(
      `${this.API}/login`,
      data
    ).pipe(
      tap(res => localStorage.setItem('token', res.token))
    );
  }

  verify(email: string, code: string) {
    return this.http.post(`${this.API}/verify`, {
      email,
      verificationCode: code
    });
  }

  logout() {
    localStorage.removeItem('token');
  }

  get token(): string | null {
    return localStorage.getItem('token');
  }
}
