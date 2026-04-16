import { createAxis } from './axis'
import { ticksBottom, ticksLeft, ticksCircular, ticksTop, ticksRight } from './ticks'
import { gridCircular, gridHorizontal, gridRay, gridVertical } from './grid'
import {
  labelLeftDown,
  labelBottomRight,
  labelTopRight,
  labelRightDown
} from './label'

const components = {
  '00': {
    defaultPosition: 'bottom',
    positions: {
      bottom: {
        start: (d, scale, offset) => [scale(d) + offset, 1],
        end: (coordinate) => coordinate([0, 0]),
        grid: gridVertical,
        ticks: ticksBottom,
        label: labelBottomRight
      },
      top: {
        start: (d, scale, offset) => [scale(d) + offset, 0],
        end: (coordinate) => coordinate([0, 1]),
        grid: gridVertical,
        ticks: ticksTop,
        label: labelTopRight
      }
    }
  },
  '01': {
    defaultPosition: 'left',
    positions: {
      left: {
        start: (d, scale, offset) => [scale(d) + offset, 1],
        end: (coordinate) => coordinate([0, 0]),
        grid: gridHorizontal,
        ticks: ticksLeft,
        label: labelLeftDown
      },
      right: {
        start: (d, scale, offset) => [scale(d) + offset, 0],
        end: (coordinate) => coordinate([1, 0]),
        grid: gridHorizontal,
        ticks: ticksRight,
        label: labelRightDown
      }
    }
  },
  10: {
    start: (d, scale, offset) => [scale(d) + offset, 0],
    grid: gridRay,
    ticks: ticksCircular,
    end: (coordinate) => coordinate.center()
  },
  11: {
    start: (d, scale, offset) => [scale(d) + offset, 1],
    grid: gridCircular,
    ticks: ticksLeft,
    end: (coordinate) => coordinate.center()
  }
}

export const axisX = createAxis(components)
