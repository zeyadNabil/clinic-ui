import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserService, User } from '../../services/user.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit, OnDestroy {
  user: User | null = null;
  private subscriptions = new Subscription();

  constructor(private userService: UserService) {}

  ngOnInit() {
    // Subscribe to user changes
    const userSub = this.userService.currentUser$.subscribe(user => {
      this.user = user;
    });
    this.subscriptions.add(userSub);
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }
}
