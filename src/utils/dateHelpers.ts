// src/utils/dateHelpers.ts

// Obtener inicio del día
export const startOfDay = (date: Date = new Date()): Date => {
  const newDate = new Date(date);
  newDate.setHours(0, 0, 0, 0);
  return newDate;
};

// Obtener fin del día
export const endOfDay = (date: Date = new Date()): Date => {
  const newDate = new Date(date);
  newDate.setHours(23, 59, 59, 999);
  return newDate;
};

// Obtener inicio de la semana (Lunes)
export const startOfWeek = (date: Date = new Date()): Date => {
  const newDate = new Date(date);
  const day = newDate.getDay();
  const diff = newDate.getDate() - day + (day === 0 ? -6 : 1);
  newDate.setDate(diff);
  newDate.setHours(0, 0, 0, 0);
  return newDate;
};

// Obtener fin de la semana (Domingo)
export const endOfWeek = (date: Date = new Date()): Date => {
  const newDate = new Date(date);
  const day = newDate.getDay();
  const diff = newDate.getDate() - day + 7;
  newDate.setDate(diff);
  newDate.setHours(23, 59, 59, 999);
  return newDate;
};

// Obtener inicio del mes
export const startOfMonth = (date: Date = new Date()): Date => {
  const newDate = new Date(date);
  newDate.setDate(1);
  newDate.setHours(0, 0, 0, 0);
  return newDate;
};

// Obtener fin del mes
export const endOfMonth = (date: Date = new Date()): Date => {
  const newDate = new Date(date);
  newDate.setMonth(newDate.getMonth() + 1, 0);
  newDate.setHours(23, 59, 59, 999);
  return newDate;
};

// Agregar minutos a una fecha
export const addMinutes = (date: Date, minutes: number): Date => {
  return new Date(date.getTime() + minutes * 60000);
};

// Agregar horas a una fecha
export const addHours = (date: Date, hours: number): Date => {
  return new Date(date.getTime() + hours * 3600000);
};

// Agregar días a una fecha
export const addDays = (date: Date, days: number): Date => {
  const newDate = new Date(date);
  newDate.setDate(newDate.getDate() + days);
  return newDate;
};

// Verificar si una fecha está entre dos fechas
export const isBetween = (date: Date, start: Date, end: Date): boolean => {
  return date >= start && date <= end;
};

// Verificar si es hoy
export const isToday = (date: Date): boolean => {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
};

// Obtener diferencia en minutos
export const differenceInMinutes = (date1: Date, date2: Date): number => {
  return Math.floor((date1.getTime() - date2.getTime()) / 60000);
};

// Obtener diferencia en horas
export const differenceInHours = (date1: Date, date2: Date): number => {
  return Math.floor((date1.getTime() - date2.getTime()) / 3600000);
};

// Formatear fecha (simple, sin librerías)
export const formatDate = (date: Date, format: string = 'DD/MM/YYYY'): string => {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');

  return format
    .replace('DD', day)
    .replace('MM', month)
    .replace('YYYY', year.toString())
    .replace('YY', year.toString().slice(-2))
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds);
};

// Parsear fecha desde string ISO
export const parseISO = (dateString: string): Date => {
  return new Date(dateString);
};

// Verificar si la fecha es válida
export const isValidDate = (date: any): boolean => {
  return date instanceof Date && !isNaN(date.getTime());
};

// Obtener día de la semana en español
export const getDayNameSpanish = (date: Date): string => {
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  return days[date.getDay()];
};

// Obtener nombre del mes en español
export const getMonthNameSpanish = (date: Date): string => {
  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  return months[date.getMonth()];
};

// Verificar si hay conflicto de horarios
export const hasScheduleConflict = (
  start1: Date,
  end1: Date,
  start2: Date,
  end2: Date
): boolean => {
  return start1 < end2 && start2 < end1;
};

// Obtener el próximo momento de rotación de QR
export const getNextQRRotation = (lastRotation: Date, rotationMinutes: number): Date => {
  return addMinutes(lastRotation, rotationMinutes);
};

// Verificar si es horario laboral (configurable)
export const isBusinessHours = (
  date: Date = new Date(),
  startHour: number = 7,
  endHour: number = 22
): boolean => {
  const hours = date.getHours();
  return hours >= startHour && hours < endHour;
};