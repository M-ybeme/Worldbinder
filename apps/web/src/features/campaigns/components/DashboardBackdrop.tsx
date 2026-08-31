import type { DashboardBackdropConfig } from '@worldbinder/contracts'
import './DashboardBackdrop.css'

export interface DashboardBackdropProps {
  imageUrl: string
  config: DashboardBackdropConfig
  className?: string
}

/**
 * The campaign cover image rendered as a fixed-height hero band — used both
 * as the Dashboard's actual backdrop (`CampaignOverviewPage`) and as the
 * live preview in `CampaignSettingsPage`'s editor, so the two never drift.
 * `fit`/`zoom`/`focalX`/`focalY` map directly onto `object-fit`/`transform:
 * scale`/`object-position` — no canvas/cropper library needed for a
 * pan+zoom+fit-mode preview.
 */
export function DashboardBackdrop({ imageUrl, config, className }: DashboardBackdropProps) {
  return (
    <div className={['wb-dashboard-backdrop', className].filter(Boolean).join(' ')}>
      <img
        src={imageUrl}
        alt=""
        aria-hidden="true"
        className="wb-dashboard-backdrop__image"
        style={{
          objectFit: config.fit === 'stretch' ? 'fill' : config.fit,
          objectPosition: `${config.focalX}% ${config.focalY}%`,
          transform: `scale(${config.zoom})`,
          transformOrigin: `${config.focalX}% ${config.focalY}%`,
          opacity: config.opacity,
        }}
      />
    </div>
  )
}
