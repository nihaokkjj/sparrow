import { createAxis } from './axis'
import {
  ticksTop,
  ticksLeft,
  ticksCircular,
  ticksBottom,
  ticksRight
} from './ticks'
import { gridCircular, gridHorizontal, gridRay, gridVertical } from './grid'
import {
  labelTopRight,
  labelLeftUp,
  labelBottomRight,
  labelRightUp
} from './label'

const components = {
  '00': {
    defaultPosition: 'left',
    positions: {
      left: {
        start: (d, scale, offset) => [0, scale(d) + offset],
        end: (coordinate) => coordinate([1, 0]),
        grid: gridHorizontal,
        ticks: ticksLeft,
        label: labelLeftUp
      },
      right: {
        start: (d, scale, offset) => [1, scale(d) + offset],
        end: (coordinate) => coordinate([0, 0]),
        grid: gridHorizontal,
        ticks: ticksRight,
        label: labelRightUp
      }
    }
  },
  '01': {
    defaultPosition: 'top',
    positions: {
      top: {
        start: (d, scale, offset) => [0, scale(d) + offset],
        end: (coordinate) => coordinate([1, 0]),
        grid: gridVertical,
        ticks: ticksTop,
        label: labelTopRight
      },
      bottom: {
        start: (d, scale, offset) => [1, scale(d) + offset],
        end: (coordinate) => coordinate([1, 1]),
        grid: gridVertical,
        ticks: ticksBottom,
        label: labelBottomRight
      }
    }
  },
  10: {
    start: (d, scale, offset) => [0, scale(d) + offset],
    grid: gridCircular,
    ticks: ticksLeft,
    end: (coordinate) => coordinate.center()
  },
  11: {
    start: (d, scale, offset) => [0, scale(d) + offset],
    grid: gridRay,
    ticks: ticksCircular,
    end: (coordinate) => coordinate.center()
  }
}

export const axisY = createAxis(components)
