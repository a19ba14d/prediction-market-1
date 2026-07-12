import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminGeneralSettingsForm from '@/app/[locale]/admin/(general)/_components/AdminGeneralSettingsForm'
import { DEFAULT_HOME_FEATURED_SETTINGS } from '@/lib/home-featured-settings'

const mocks = vi.hoisted(() => ({
  removeTermsOfServicePdfAction: vi.fn(),
  updateGeneralSettingsAction: vi.fn(),
  optimizeSideCardImage: vi.fn(),
  createObjectURL: vi.fn(),
  revokeObjectURL: vi.fn(),
}))

vi.mock('next-intl', () => ({
  useExtracted: () => (value: string) => value,
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

vi.mock('next/image', () => ({
  __esModule: true,
  default: ({ fill: _fill, unoptimized: _unoptimized, ...props }: any) => React.createElement('img', props),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('@/app/[locale]/admin/(general)/_actions/update-general-settings', () => ({
  updateGeneralSettingsAction: (...args: any[]) => mocks.updateGeneralSettingsAction(...args),
  removeTermsOfServicePdfAction: (...args: any[]) => mocks.removeTermsOfServicePdfAction(...args),
}))

vi.mock('@/lib/side-card-image-client', () => ({
  optimizeSideCardImage: (...args: any[]) => mocks.optimizeSideCardImage(...args),
}))

vi.mock('@/app/[locale]/admin/(general)/_components/AllowedMarketCreatorsManager', () => ({
  __esModule: true,
  default: () => React.createElement('div', { 'data-testid': 'allowed-market-creators-manager' }),
}))

describe('adminGeneralSettingsForm', () => {
  beforeEach(() => {
    mocks.removeTermsOfServicePdfAction.mockReset()
    mocks.updateGeneralSettingsAction.mockReset()
    mocks.optimizeSideCardImage.mockReset()
    mocks.createObjectURL.mockReset()
    mocks.revokeObjectURL.mockReset()
    mocks.updateGeneralSettingsAction.mockResolvedValue({ error: null })
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: mocks.createObjectURL,
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: mocks.revokeObjectURL,
    })
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
  })

  it('invokes the remove PDF action from the legal section', async () => {
    const user = userEvent.setup()
    mocks.removeTermsOfServicePdfAction.mockResolvedValueOnce({ error: null })

    const { container } = render(
      <AdminGeneralSettingsForm
        initialThemeSiteSettings={{
          siteName: 'Kuest',
          siteDescription: 'Prediction market',
          logoMode: 'svg',
          logoSvg: '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
          logoImagePath: '',
          logoImageUrl: null,
          pwaIcon192Path: '',
          pwaIcon192Url: '/icon-192.png',
          pwaIcon512Path: '',
          pwaIcon512Url: '/icon-512.png',
          googleAnalyticsId: '',
          discordLink: '',
          twitterLink: '',
          facebookLink: '',
          instagramLink: '',
          tiktokLink: '',
          linkedinLink: '',
          youtubeLink: '',
          supportUrl: '',
          customJavascriptCodes: [],
          feeRecipientWallet: '',
          lifiIntegrator: '',
          lifiApiKey: '',
          lifiApiKeyConfigured: false,
        }}
        initialGlobalAnnouncement={{
          message: '',
          linkUrl: '',
          disabledOn: [],
          disableFaucetBanner: false,
        }}
        initialBlockedCountries={[]}
        initialTermsOfServicePdfPath="legal/current-terms.pdf"
        initialTermsOfServicePdfUrl="https://cdn.example.com/legal/current-terms.pdf"
        openRouterSettings={{
          defaultModel: '',
          isApiKeyConfigured: false,
          isModelSelectEnabled: false,
          modelOptions: [],
        }}
        sportsSourceSettings={{
          isPandaScoreTokenConfigured: false,
          isTheSportsDbApiKeyConfigured: false,
        }}
      />,
    )

    await user.click(screen.getByRole('button', { name: /Legal/i }))
    expect((container.querySelector('input[name="tos_pdf_path"]') as HTMLInputElement).value).toBe('legal/current-terms.pdf')
    await user.click(screen.getByRole('button', { name: /Remove uploaded PDF/i }))

    await waitFor(() => {
      expect(mocks.removeTermsOfServicePdfAction).toHaveBeenCalledTimes(1)
      expect((container.querySelector('input[name="tos_pdf_path"]') as HTMLInputElement).value).toBe('')
    })
  })

  it('starts with sections collapsed and keeps inputs mounted while toggling', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <AdminGeneralSettingsForm
        initialThemeSiteSettings={{
          siteName: 'Kuest',
          siteDescription: 'Prediction market',
          logoMode: 'svg',
          logoSvg: '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
          logoImagePath: '',
          logoImageUrl: null,
          pwaIcon192Path: '',
          pwaIcon192Url: '/icon-192.png',
          pwaIcon512Path: '',
          pwaIcon512Url: '/icon-512.png',
          googleAnalyticsId: '',
          discordLink: '',
          twitterLink: '',
          facebookLink: '',
          instagramLink: '',
          tiktokLink: '',
          linkedinLink: '',
          youtubeLink: '',
          supportUrl: '',
          customJavascriptCodes: [],
          feeRecipientWallet: '',
          lifiIntegrator: '',
          lifiApiKey: '',
          lifiApiKeyConfigured: false,
        }}
        initialGlobalAnnouncement={{
          message: '',
          linkUrl: '',
          disabledOn: [],
          disableFaucetBanner: false,
        }}
        initialBlockedCountries={[]}
        initialTermsOfServicePdfPath=""
        initialTermsOfServicePdfUrl={null}
        openRouterSettings={{
          defaultModel: '',
          isApiKeyConfigured: false,
          isModelSelectEnabled: false,
          modelOptions: [],
        }}
        sportsSourceSettings={{
          isPandaScoreTokenConfigured: false,
          isTheSportsDbApiKeyConfigured: false,
        }}
      />,
    )

    expect(screen.getByRole('button', { name: /Brand identity/i })).toHaveAttribute('aria-expanded', 'false')
    expect(container.querySelector('input[name="site_name"]')).toBeTruthy()
    expect(container.querySelector('input[name="google_analytics_id"]')).toBeTruthy()
    expect(container.querySelector('input[name="tos_pdf_path"]')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /Brand identity/i }))
    expect(screen.getByRole('button', { name: /Brand identity/i })).toHaveAttribute('aria-expanded', 'true')

    await user.click(screen.getByRole('button', { name: /Brand identity/i }))
    expect(screen.getByRole('button', { name: /Brand identity/i })).toHaveAttribute('aria-expanded', 'false')
  })

  it('submits the optimized side card image instead of the original file', async () => {
    const user = userEvent.setup()
    const originalFile = new File(['original'], 'side-card.png', { type: 'image/png' })
    const optimizedFile = new File(['optimized'], 'side-card.jpg', { type: 'image/jpeg' })
    mocks.optimizeSideCardImage.mockResolvedValueOnce(optimizedFile)
    mocks.createObjectURL.mockReturnValueOnce('blob:optimized-side-card')

    const { container } = render(
      <AdminGeneralSettingsForm
        initialThemeSiteSettings={{
          siteName: 'Kuest',
          siteDescription: 'Prediction market',
          logoMode: 'svg',
          logoSvg: '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
          logoImagePath: '',
          logoImageUrl: null,
          pwaIcon192Path: '',
          pwaIcon192Url: '/icon-192.png',
          pwaIcon512Path: '',
          pwaIcon512Url: '/icon-512.png',
          googleAnalyticsId: '',
          discordLink: '',
          twitterLink: '',
          facebookLink: '',
          instagramLink: '',
          tiktokLink: '',
          linkedinLink: '',
          youtubeLink: '',
          supportUrl: '',
          customJavascriptCodes: [],
          feeRecipientWallet: '',
          lifiIntegrator: '',
          lifiApiKey: '',
          lifiApiKeyConfigured: false,
        }}
        initialGlobalAnnouncement={{
          message: '',
          linkUrl: '',
          disabledOn: [],
          disableFaucetBanner: false,
        }}
        initialBlockedCountries={[]}
        initialTermsOfServicePdfPath=""
        initialTermsOfServicePdfUrl={null}
        initialHomeFeaturedSettings={{
          ...DEFAULT_HOME_FEATURED_SETTINGS,
          sideCard: {
            ...DEFAULT_HOME_FEATURED_SETTINGS.sideCard,
            useImage: true,
          },
        }}
        openRouterSettings={{
          defaultModel: '',
          isApiKeyConfigured: false,
          isModelSelectEnabled: false,
          modelOptions: [],
        }}
        sportsSourceSettings={{
          isPandaScoreTokenConfigured: false,
          isTheSportsDbApiKeyConfigured: false,
        }}
      />,
    )

    const sideCardInput = container.querySelector('#home-featured-side-card-image-file') as HTMLInputElement
    await user.upload(sideCardInput, originalFile)

    await waitFor(() => {
      expect(mocks.optimizeSideCardImage).toHaveBeenCalledWith(originalFile)
      expect(mocks.createObjectURL).toHaveBeenCalledWith(optimizedFile)
      expect(screen.getByRole('button', { name: /Save settings/i })).toBeEnabled()
    })

    await user.click(screen.getByRole('button', { name: /Save settings/i }))

    await waitFor(() => expect(mocks.updateGeneralSettingsAction).toHaveBeenCalledOnce())
    const [previousState, formData] = mocks.updateGeneralSettingsAction.mock.calls[0] as [
      { error: null },
      FormData,
    ]
    expect(previousState).toEqual({ error: null })
    expect(formData.get('home_featured_side_card_image')).toBe(optimizedFile)
  })
})
