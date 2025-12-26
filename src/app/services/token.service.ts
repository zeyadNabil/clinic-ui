import { Injectable } from '@angular/core';
import { jwtDecode } from 'jwt-decode';

export interface TokenPayload {
  sub?: string;
  email?: string;
  role?: string;
  exp?: number;
  iat?: number;
  [key: string]: any;
}

@Injectable({
  providedIn: 'root'
})
export class TokenService {
  private readonly TOKEN_KEY = 'token';
  private readonly USER_ROLE_KEY = 'userRole';
  private readonly USER_DATA_KEY = 'userData';
  private readonly TOKEN_EXPIRY_KEY = 'tokenExpiry';

  /**
   * Store token and calculate expiry time
   *
   * @param token - JWT token string
   * @param expiresIn - Token expiration time in milliseconds (default: 3600000 = 1 hour)
   *                    Backend returns expiresIn: 3600000 (1 hour = 60 minutes * 60 seconds * 1000 milliseconds)
   */
  setToken(token: string, expiresIn?: number): void {
    if (!token) {
      console.warn('Attempted to set empty token');
      return;
    }

    localStorage.setItem(this.TOKEN_KEY, token);

    // Calculate expiry time if expiresIn is provided (in milliseconds)
    // Backend typically returns 3600000 ms (1 hour)
    if (expiresIn && expiresIn > 0) {
      const expiryTime = Date.now() + expiresIn;
      localStorage.setItem(this.TOKEN_EXPIRY_KEY, expiryTime.toString());
    } else {
      // Try to get expiry from token itself
      try {
        const decoded = this.decodeToken(token);
        if (decoded?.exp) {
          // exp is in seconds, convert to milliseconds
          const expiryTime = decoded.exp * 1000;
          localStorage.setItem(this.TOKEN_EXPIRY_KEY, expiryTime.toString());
        }
      } catch (e) {
        console.warn('Could not decode token to get expiry time', e);
      }
    }
  }

  /**
   * Get stored token
   */
  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  /**
   * Check if token exists and is valid (not expired)
   */
  isTokenValid(): boolean {
    const token = this.getToken();
    if (!token) {
      return false;
    }

    // Check if token is expired
    if (this.isTokenExpired()) {
      this.removeToken();
      return false;
    }

    // Check if token can be decoded (basic validation)
    try {
      this.decodeToken(token);
      return true;
    } catch (e) {
      console.warn('Token is invalid or corrupted', e);
      this.removeToken();
      return false;
    }
  }

  /**
   * Check if token is expired
   */
  isTokenExpired(): boolean {
    const token = this.getToken();
    if (!token) {
      return true;
    }

    // First check stored expiry time
    const storedExpiry = localStorage.getItem(this.TOKEN_EXPIRY_KEY);
    if (storedExpiry) {
      const expiryTime = parseInt(storedExpiry, 10);
      if (Date.now() >= expiryTime) {
        return true;
      }
    }

    // Also check token's exp claim
    try {
      const decoded = this.decodeToken(token);
      if (decoded?.exp) {
        // exp is in seconds, convert to milliseconds for comparison
        const expiryTime = decoded.exp * 1000;
        if (Date.now() >= expiryTime) {
          return true;
        }
      }
    } catch (e) {
      // If we can't decode, consider it expired
      return true;
    }

    return false;
  }

  /**
   * Decode token payload
   */
  decodeToken(token: string): TokenPayload | null {
    try {
      return jwtDecode<TokenPayload>(token);
    } catch (e) {
      console.error('Error decoding token:', e);
      return null;
    }
  }

  /**
   * Get user role from token
   */
  getRoleFromToken(): string | null {
    const token = this.getToken();
    if (!token) {
      return null;
    }

    try {
      const decoded = this.decodeToken(token);
      if (!decoded?.role) {
        return null;
      }

      let role = decoded.role;
      // Remove ROLE_ prefix if present (handle multiple prefixes)
      while (role && /^ROLE_/i.test(role)) {
        role = role.replace(/^ROLE_/i, '');
      }

      return role.toUpperCase();
    } catch (e) {
      console.error('Error getting role from token:', e);
      return null;
    }
  }

  /**
   * Store user role
   */
  setUserRole(role: string): void {
    if (role) {
      // Normalize role - remove ROLE_ prefix
      let normalizedRole = role;
      while (normalizedRole && /^ROLE_/i.test(normalizedRole)) {
        normalizedRole = normalizedRole.replace(/^ROLE_/i, '');
      }
      localStorage.setItem(this.USER_ROLE_KEY, normalizedRole.toUpperCase());
    }
  }

  /**
   * Get stored user role
   */
  getUserRole(): string | null {
    return localStorage.getItem(this.USER_ROLE_KEY);
  }

  /**
   * Store user data
   */
  setUserData(userData: {
    email: string;
    username?: string;
    name?: string;
    role?: string;
    id?: number;
  }): void {
    localStorage.setItem(this.USER_DATA_KEY, JSON.stringify(userData));

    // Also store role separately for easy access
    if (userData.role) {
      this.setUserRole(userData.role);
    }
  }

  /**
   * Get stored user data
   */
  getUserData(): {
    email: string;
    username?: string;
    name?: string;
    role?: string;
    id?: number;
  } | null {
    const data = localStorage.getItem(this.USER_DATA_KEY);
    if (!data) {
      return null;
    }

    try {
      return JSON.parse(data);
    } catch (e) {
      console.error('Error parsing user data from localStorage:', e);
      return null;
    }
  }

  /**
   * Remove token and all related data from TokenService
   */
  removeToken(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_ROLE_KEY);
    localStorage.removeItem(this.USER_DATA_KEY);
    localStorage.removeItem(this.TOKEN_EXPIRY_KEY);
  }

  /**
   * Clear ALL authentication data
   * This removes everything related to authentication from localStorage
   */
  clearAll(): void {
    // Remove TokenService managed keys (token, userRole, userData, tokenExpiry)
    this.removeToken();
  }
}

