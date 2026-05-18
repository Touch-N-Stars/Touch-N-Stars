import { defineStore } from 'pinia';
import { parseHrz, exportHrz } from '../utils/horizon-utils';

export const useHorizonStore = defineStore('horizonStore', {
  state: () => ({
    points: JSON.parse(localStorage.getItem('horizon_creator_points') || '[]'),
  }),
  actions: {
    addPoint(alt, az) {
      this.points = [...this.points, { alt, az }];
      this._save();
    },
    removeLastPoint() {
      if (this.points.length > 0) {
        this.points = this.points.slice(0, -1);
        this._save();
      }
    },
    clearPoints() {
      this.points = [];
      this._save();
    },
    loadFromHrz(text) {
      const parsed = parseHrz(text);
      if (parsed.length > 0) {
        this.points = parsed;
        this._save();
      }
      return parsed.length;
    },
    getHrz() {
      return exportHrz(this.points);
    },
    _save() {
      localStorage.setItem('horizon_creator_points', JSON.stringify(this.points));
    },
  },
});
