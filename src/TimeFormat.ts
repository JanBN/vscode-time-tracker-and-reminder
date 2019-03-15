'use strict';
import * as moment from 'moment';

export function formatTimeFromMiliseconds(miliseconds: number, format: string = null): string {
  return formatTime(miliseconds / 1000, format);
}

export function formatTime(seconds: number, format: string = null): string {

  if (!format) {
    format = "y[y] M[M] w[w] d[d] h[h] m[m]";
  }

  const duration = <any>moment.duration(seconds, 'seconds');
  return duration.format(format);
}