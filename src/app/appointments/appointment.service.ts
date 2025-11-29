import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Appointment {
  id: string;
  patientName: string;
  doctorName: string;
  dateTime: string;
  type?: string;
  status?: string;
  notes?: string;
}

@Injectable({ providedIn: 'root' })
export class AppointmentService {
  private baseUrl = 'http://localhost:8080';

  constructor(private http: HttpClient) {}

  getAppointmentsByDoctor(doctorId: string): Observable<Appointment[]> {
  const url = `${this.baseUrl}/api/appointments/doctor/${doctorId}/schedule`;
  return this.http.get<any[]>(url).pipe(
  map(list => (list || []).map(a => {
    const dateObj = a.date && a.time ? new Date(`${a.date}T${a.time}`) : new Date();
    return {
      id: String(a.id),
      patientName: a.patient?.name || '',
      doctorName: a.doctor?.name || '',
      dateTime: dateObj.toISOString(),
      type: a.notes || '',
      status: a.status || 'Pending',
      notes: a.notes || '',
    } as Appointment;
  }))
);
  }

}
