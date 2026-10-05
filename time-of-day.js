(function (root, factory) {
  var api = factory()

  if (typeof module === 'object' && module.exports) {
    module.exports = api
  }

  if (root) {
    root.DodoTime = api
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict'

  var DAY_MINUTES = 24 * 60
  var TEXT_CONTRAST_TARGET = 4.5

  var KEYFRAMES = [
    {
      minute: 0,
      colors: {
        paper: '#101722',
        accent: '#f2b68f',
        line: '#4a4350',
        sky: '#1c2940',
        glow: '#593c48',
        haze: '#292c40'
      },
      glowX: 72,
      glowY: 28
    },
    {
      minute: 300,
      colors: {
        paper: '#34465c',
        accent: '#e6bd9f',
        line: '#687384',
        sky: '#52647a',
        glow: '#66515d',
        haze: '#4b475c'
      },
      glowX: 22,
      glowY: 34
    },
    {
      minute: 432,
      colors: {
        paper: '#ebe9e6',
        accent: '#ae543d',
        line: '#aab1ba',
        sky: '#bdcedd',
        glow: '#f3c3a4',
        haze: '#d4c4cf'
      },
      glowX: 76,
      glowY: 42
    },
    {
      minute: 804,
      colors: {
        paper: '#f3efe5',
        accent: '#a84b31',
        line: '#c8c2b7',
        sky: '#c7dce3',
        glow: '#f1d697',
        haze: '#e5d7c2'
      },
      glowX: 58,
      glowY: 30
    },
    {
      minute: 1116,
      colors: {
        paper: '#eee0d2',
        accent: '#7c2f24',
        line: '#ae756f',
        sky: '#aa8394',
        glow: '#e5a15f',
        haze: '#bf7f78'
      },
      glowX: 80,
      glowY: 48
    },
    {
      minute: 1388,
      colors: {
        paper: '#25263a',
        accent: '#f1b58e',
        line: '#585064',
        sky: '#343b59',
        glow: '#5d3f4c',
        haze: '#3d354a'
      },
      glowX: 84,
      glowY: 38
    }
  ]

  function normalizeMinutes(value) {
    var minutes = Number(value)

    if (!Number.isFinite(minutes)) {
      return 0
    }

    return ((minutes % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES
  }

  function hexToRgb(hex) {
    return {
      r: parseInt(hex.slice(1, 3), 16),
      g: parseInt(hex.slice(3, 5), 16),
      b: parseInt(hex.slice(5, 7), 16)
    }
  }

  function channelToHex(channel) {
    return Math.round(channel).toString(16).padStart(2, '0')
  }

  function rgbToHex(rgb) {
    return '#' + channelToHex(rgb.r) + channelToHex(rgb.g) + channelToHex(rgb.b)
  }

  function mixNumber(start, end, amount) {
    return start + (end - start) * amount
  }

  function mixHex(start, end, amount) {
    var from = hexToRgb(start)
    var to = hexToRgb(end)

    return rgbToHex({
      r: mixNumber(from.r, to.r, amount),
      g: mixNumber(from.g, to.g, amount),
      b: mixNumber(from.b, to.b, amount)
    })
  }

  function smoothstep(amount) {
    return amount * amount * (3 - 2 * amount)
  }

  function relativeLuminance(hex) {
    var rgb = hexToRgb(hex)
    var channels = [rgb.r, rgb.g, rgb.b].map(function (channel) {
      var value = channel / 255
      return value <= 0.04045
        ? value / 12.92
        : Math.pow((value + 0.055) / 1.055, 2.4)
    })

    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
  }

  function contrastRatio(first, second) {
    var firstLuminance = relativeLuminance(first)
    var secondLuminance = relativeLuminance(second)
    var lighter = Math.max(firstLuminance, secondLuminance)
    var darker = Math.min(firstLuminance, secondLuminance)

    return (lighter + 0.05) / (darker + 0.05)
  }

  function minimumContrast(foreground, surfaces) {
    return surfaces.reduce(function (lowest, surface) {
      return Math.min(lowest, contrastRatio(foreground, surface))
    }, Infinity)
  }

  function compatibleSurface(surface, paper, ink) {
    if (contrastRatio(ink, surface) >= TEXT_CONTRAST_TARGET) {
      return surface
    }

    var low = 0
    var high = 1
    var best = paper

    // Keep as much of the decorative hue as possible while bringing its
    // luminance into the same readable band as the flat paper color.
    for (var iteration = 0; iteration < 16; iteration += 1) {
      var amount = (low + high) / 2
      var candidate = mixHex(paper, surface, amount)

      if (contrastRatio(ink, candidate) >= TEXT_CONTRAST_TARGET) {
        best = candidate
        low = amount
      } else {
        high = amount
      }
    }

    return best
  }

  function decorativeStrength(paper) {
    // At the one luminance where readable foregrounds switch from light to
    // dark, decorative layers converge on paper. This keeps the background
    // continuous while the foreground makes its deliberate contrast swap.
    var distanceFromCrossover = Math.abs(relativeLuminance(paper) - 0.179)
    return smoothstep(Math.min(1, distanceFromCrossover / 0.16))
  }

  function readableForeground(color, ink, surfaces) {
    if (minimumContrast(color, surfaces) >= TEXT_CONTRAST_TARGET) {
      return color
    }

    var low = 0
    var high = 1
    var best = ink

    // Repair a foreground towards the already-readable ink. Starting at ink
    // guarantees a safe fallback even at the light/dark crossover.
    for (var iteration = 0; iteration < 16; iteration += 1) {
      var amount = (low + high) / 2
      var candidate = mixHex(ink, color, amount)

      if (minimumContrast(candidate, surfaces) >= TEXT_CONTRAST_TARGET) {
        best = candidate
        low = amount
      } else {
        high = amount
      }
    }

    return best
  }

  function mutedColor(ink, paper, surfaces) {
    var low = 0
    var high = 1
    var best = ink

    // Move from the foreground towards the paper until just before readability
    // falls below WCAG AA for normal text.
    for (var iteration = 0; iteration < 16; iteration += 1) {
      var amount = (low + high) / 2
      var candidate = mixHex(ink, paper, amount)

      if (minimumContrast(candidate, surfaces) >= TEXT_CONTRAST_TARGET) {
        best = candidate
        low = amount
      } else {
        high = amount
      }
    }

    return best
  }

  function readableText(paper) {
    var darkInk = '#0b1018'
    var lightInk = '#fffaf2'
    var darkContrast = contrastRatio(darkInk, paper)
    var lightContrast = contrastRatio(lightInk, paper)
    var ink = darkContrast >= lightContrast ? darkInk : lightInk

    // Near the luminance crossover, subtly tinted inks can both miss AA by a
    // fraction. Pure black or white closes that narrow gap deterministically.
    if (contrastRatio(ink, paper) < TEXT_CONTRAST_TARGET) {
      ink = relativeLuminance(paper) >= 0.179 ? '#000000' : '#ffffff'
    }

    return {
      ink: ink,
      dark: ink === lightInk || ink === '#ffffff'
    }
  }

  function surroundingKeyframes(minutes) {
    for (var index = 0; index < KEYFRAMES.length - 1; index += 1) {
      if (minutes >= KEYFRAMES[index].minute && minutes < KEYFRAMES[index + 1].minute) {
        return {
          start: KEYFRAMES[index],
          end: KEYFRAMES[index + 1],
          elapsed: minutes - KEYFRAMES[index].minute,
          duration: KEYFRAMES[index + 1].minute - KEYFRAMES[index].minute
        }
      }
    }

    return {
      start: KEYFRAMES[KEYFRAMES.length - 1],
      end: KEYFRAMES[0],
      elapsed: minutes - KEYFRAMES[KEYFRAMES.length - 1].minute,
      duration: DAY_MINUTES - KEYFRAMES[KEYFRAMES.length - 1].minute
    }
  }

  function timeLabel(minutes) {
    if (minutes >= 300 && minutes < 630) {
      return 'First light'
    }

    if (minutes >= 630 && minutes < 990) {
      return 'Daylight'
    }

    if (minutes >= 990 && minutes < 1260) {
      return 'Afterglow'
    }

    return 'Still night'
  }

  function clockString(minutes) {
    var wholeMinutes = Math.floor(minutes)
    var hours = Math.floor(wholeMinutes / 60)
    var minute = wholeMinutes % 60

    return String(hours).padStart(2, '0') + ':' + String(minute).padStart(2, '0')
  }

  function getState(value) {
    var minutes = normalizeMinutes(value)
    var frame = surroundingKeyframes(minutes)
    var progress = smoothstep(frame.elapsed / frame.duration)
    var colors = {}

    Object.keys(frame.start.colors).forEach(function (name) {
      colors[name] = mixHex(frame.start.colors[name], frame.end.colors[name], progress)
    })

    var text = readableText(colors.paper)
    var surfaceNames = ['paper', 'sky', 'glow', 'haze']
    var surfaceStrength = decorativeStrength(colors.paper)

    surfaceNames.slice(1).forEach(function (name) {
      var softenedSurface = mixHex(colors.paper, colors[name], surfaceStrength)
      colors[name] = compatibleSurface(softenedSurface, colors.paper, text.ink)
    })

    var surfaces = surfaceNames.map(function (name) {
      return colors[name]
    })

    colors.ink = text.ink
    colors.muted = mutedColor(text.ink, colors.paper, surfaces)
    colors.accent = readableForeground(colors.accent, text.ink, surfaces)

    return {
      minutes: minutes,
      clock: clockString(minutes),
      label: timeLabel(minutes),
      dark: text.dark,
      colors: {
        paper: colors.paper,
        ink: colors.ink,
        muted: colors.muted,
        accent: colors.accent,
        line: colors.line,
        sky: colors.sky,
        glow: colors.glow,
        haze: colors.haze
      },
      glowX: mixNumber(frame.start.glowX, frame.end.glowX, progress),
      glowY: mixNumber(frame.start.glowY, frame.end.glowY, progress)
    }
  }

  function minutesFromDate(date) {
    if (!(date instanceof Date) || !Number.isFinite(date.getTime())) {
      return 0
    }

    return date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60 + date.getMilliseconds() / 60000
  }

  return {
    normalizeMinutes: normalizeMinutes,
    getState: getState,
    minutesFromDate: minutesFromDate
  }
})
