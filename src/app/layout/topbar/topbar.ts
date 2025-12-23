import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { UserService } from '../../services/user.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-topbar',
  imports: [CommonModule, RouterModule],
  templateUrl: './topbar.html',
  styleUrl: './topbar.css',
})
export class Topbar implements OnInit, OnDestroy {
  userProfile = {
    name: '',
    role: '',
    avatar: ''
  };

  notificationCount: number = 0;
  private subscriptions = new Subscription();

  notifications: any[] = []; // Empty - will be populated from database if needed

  constructor(private userService: UserService) {}

  ngOnInit() {
    // Subscribe to user changes
    const userSub = this.userService.currentUser$.subscribe(user => {
      this.userProfile.name = this.userService.getDisplayName();
      this.userProfile.role = this.userService.getRoleDisplayText();
    });
    this.subscriptions.add(userSub);
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }
}
