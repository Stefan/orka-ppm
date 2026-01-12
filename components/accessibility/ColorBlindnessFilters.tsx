'use client'

/**
 * ColorBlindnessFilters component provides SVG filters for color blindness simulation
 */
export default function ColorBlindnessFilters() {
  return (
    <svg className="colorblind-filters" aria-hidden="true">
      <defs>
        {/* Deuteranopia (Green-blind) filter */}
        <filter id="deuteranopia-filter">
          <feColorMatrix
            type="matrix"
            values="0.625 0.375 0   0 0
                    0.7   0.3   0   0 0
                    0     0.3   0.7 0 0
                    0     0     0   1 0"
          />
        </filter>

        {/* Protanopia (Red-blind) filter */}
        <filter id="protanopia-filter">
          <feColorMatrix
            type="matrix"
            values="0.567 0.433 0     0 0
                    0.558 0.442 0     0 0
                    0     0.242 0.758 0 0
                    0     0     0     1 0"
          />
        </filter>

        {/* Tritanopia (Blue-blind) filter */}
        <filter id="tritanopia-filter">
          <feColorMatrix
            type="matrix"
            values="0.95  0.05  0     0 0
                    0     0.433 0.567 0 0
                    0     0.475 0.525 0 0
                    0     0     0     1 0"
          />
        </filter>

        {/* High contrast enhancement filter */}
        <filter id="high-contrast-filter">
          <feComponentTransfer>
            <feFuncA type="discrete" tableValues="0 .5 1"/>
          </feComponentTransfer>
        </filter>

        {/* Brightness enhancement filter */}
        <filter id="brightness-filter">
          <feComponentTransfer>
            <feFuncR type="linear" slope="1.2"/>
            <feFuncG type="linear" slope="1.2"/>
            <feFuncB type="linear" slope="1.2"/>
          </feComponentTransfer>
        </filter>
      </defs>
    </svg>
  )
}