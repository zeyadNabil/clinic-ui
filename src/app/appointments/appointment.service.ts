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
    const url = `${this.baseUrl}/api/appointments`;
    return this.http.get<any[]>(url).pipe(
      map(list => (list || [])
        .filter(a => a?.doctor?.id != null && String(a.doctor.id) === String(doctorId))
        .map(a => {
          const dateObj = a.date && a.time ? new Date(`${a.date}T${a.time}`) : (a.dateTime ? new Date(a.dateTime) : new Date());
          return {
            id: String(a.id),
            patientName: a.patient?.name || '',
            doctorName: a.doctor?.name || '',
            dateTime: dateObj.toISOString(),
            type: a.type || undefined,
            status: a.status ?? null,
            notes: a.notes ?? null,
          } as Appointment;
        })
      )
    );
  }
}
