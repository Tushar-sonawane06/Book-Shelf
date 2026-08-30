import {
  required,
  isNumber,
  minNumber,
} from '../utils/validators.js';

export const setGoalSchema = {
  yearlyGoal: {
    rules: [
      required('yearlyGoal'),
      isNumber('yearlyGoal'),
      minNumber('yearlyGoal', 1),
      (val) => (typeof val === 'number' && val > 365 ? 'yearlyGoal must be at most 365' : null),
    ],
  },
};
