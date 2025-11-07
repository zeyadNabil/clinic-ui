import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SidebarService {
  private sidebarOpenSubject = new BehaviorSubject<boolean>(false);
  sidebarOpen$ = this.sidebarOpenSubject.asObservable();

  toggle() {
    this.sidebarOpenSubject.next(!this.sidebarOpenSubject.value);
  }

  open() {
    this.sidebarOpenSubject.next(true);
  }

  close() {
    this.sidebarOpenSubject.next(false);
  }
}

