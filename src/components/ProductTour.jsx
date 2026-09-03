import { useEffect, useRef } from 'react'
import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import api from '../services/api'
import { ROLES } from '../utils/constants'

// ─── Step definitions ─────────────────────────────────────────────────────────
const ALL_STEPS = [
  {
    element: null,
    route: '/dashboard',
    popover: {
      title: '👋 Welcome to your Vendor Portal',
      description: 'This short tour walks you through every page — Dashboard, Live Feedback, Alerts, Devices, Users and more. Takes about 2 minutes.',
    },
  },
  {
    element: '[data-tour="navbar"]',
    route: '/dashboard',
    popover: {
      title: 'Top Navigation Bar',
      description: 'Shows your current page, breadcrumb, and quick actions — including the "Take a tour" button.',
      side: 'bottom', align: 'start',
    },
  },
  {
    element: '[data-tour="dashboard-filters"]',
    route: '/dashboard',
    popover: {
      title: 'Dashboard Filters',
      description: 'Narrow all KPI cards, charts, and the map to a specific site, floor, or zone. Select a site first — Floor and Zone cascade automatically.',
      side: 'bottom', align: 'start',
    },
  },
  {
    element: '[data-tour="dashboard-kpi-cards"]',
    route: '/dashboard',
    popover: {
      title: 'Live KPI Cards',
      description: "Refresh every 30 s — today's Happy / Unhappy / Okay counts, active alerts, and device health at a glance.",
      side: 'bottom', align: 'start',
    },
  },
  {
    element: '[data-tour="dashboard-alerts"]',
    route: '/dashboard',
    popover: {
      title: 'Active Alerts Widget',
      description: 'Most urgent open alerts listed here. Acknowledge or Resolve directly — or go to Alert Management for the full table.',
      side: 'top', align: 'start',
    },
  },
  {
    element: '[data-tour="live-feedback-toolbar"]',
    route: '/live-feedback',
    popover: {
      title: 'Live Feedback Filters',
      description: 'Filter real-time feedback by type, site, floor, zone, or device. Updates instantly via Socket.IO — no page refresh needed.',
      side: 'bottom', align: 'start',
    },
  },
  {
    element: '[data-tour="live-feedback-table"]',
    route: '/live-feedback',
    popover: {
      title: 'Feedback Event Stream',
      description: 'Every button press appears here in real time. New rows appear at the top highlighted red when a visitor presses "Unhappy".',
      side: 'top', align: 'start',
    },
  },
  {
    element: '[data-tour="reports-filters"]',
    route: '/reports',
    popover: {
      title: 'Report Filters',
      description: 'Choose date range, report type (Feedback Trends, Alerts, Device Health, Battery), site, floor, or restroom.',
      side: 'bottom', align: 'start',
    },
  },
  {
    element: '[data-tour="reports-export"]',
    route: '/reports',
    popover: {
      title: 'Export Reports',
      description: 'Download the current report as CSV or Excel. The export reflects your active filters exactly.',
      side: 'bottom', align: 'end',
    },
  },
  {
    element: '[data-tour="site-config-wizard"]',
    route: '/site-config',
    roles: [ROLES.VENDOR_ADMIN, ROLES.SUPER_ADMIN, ROLES.REGIONAL_MANAGER, ROLES.VENDOR_MANAGER, ROLES.FACILITY_MANAGER],
    popover: {
      title: 'Site Configuration — 6-Step Wizard',
      description: 'Configure your estate in 6 steps: Define Site → Floor Plans → Draw Zones → Place Devices → Place Gateways → Review. Click any step number to jump to it.',
      side: 'bottom', align: 'start',
    },
  },
  // ── Step 1: Define Site ───────────────────────────────────────────────────
  {
    element: '[data-tour="sc-site-form"]',
    route: '/site-config',
    roles: [ROLES.VENDOR_ADMIN, ROLES.SUPER_ADMIN, ROLES.REGIONAL_MANAGER, ROLES.VENDOR_MANAGER, ROLES.FACILITY_MANAGER],
    popover: {
      title: 'Step 1 — Define Your Site',
      description: 'Fill in the Site Name (e.g. "Pune HQ"), Site Type (Office / Hospital…), and the Location city. These details appear on all reports and the Floor Map.',
      side: 'right', align: 'start',
    },
  },
  {
    element: '[data-tour="sc-coordinates"]',
    route: '/site-config',
    roles: [ROLES.VENDOR_ADMIN, ROLES.SUPER_ADMIN, ROLES.REGIONAL_MANAGER, ROLES.VENDOR_MANAGER, ROLES.FACILITY_MANAGER],
    popover: {
      title: 'GPS Coordinates',
      description: 'Enter latitude and longitude — or click "Mark centre on map" to drop a pin visually. This anchors your floor plans to real geography.',
      side: 'top', align: 'start',
    },
  },
  {
    element: '[data-tour="sc-site-preview"]',
    route: '/site-config',
    roles: [ROLES.VENDOR_ADMIN, ROLES.SUPER_ADMIN, ROLES.REGIONAL_MANAGER, ROLES.VENDOR_MANAGER, ROLES.FACILITY_MANAGER],
    popover: {
      title: 'Live Site Preview',
      description: 'As you fill in the form a live preview updates here — site name, type, location, and a mini map pin. When it looks right click "Save & Continue →".',
      side: 'left', align: 'start',
    },
  },
  // ── Step 2: Floor Plans ───────────────────────────────────────────────────
  {
    element: '[data-tour="sc-align-controls"]',
    route: '/site-config',
    wizardStep: 2,
    roles: [ROLES.VENDOR_ADMIN, ROLES.SUPER_ADMIN, ROLES.REGIONAL_MANAGER, ROLES.VENDOR_MANAGER, ROLES.FACILITY_MANAGER],
    popover: {
      title: 'Step 2 — Upload & Align Floor Plan',
      description: 'Click "Upload floor plan" to add a PNG/JPG image. Then drag the ✥ handle to move it, use corner handles to resize, and the rotation slider to rotate it precisely over the satellite map.',
      side: 'left', align: 'start',
    },
  },
  // ── Step 3: Draw Zones ────────────────────────────────────────────────────
  {
    element: '[data-tour="sc-zone-toolbox"]',
    route: '/site-config',
    wizardStep: 3,
    roles: [ROLES.VENDOR_ADMIN, ROLES.SUPER_ADMIN, ROLES.REGIONAL_MANAGER, ROLES.VENDOR_MANAGER, ROLES.FACILITY_MANAGER],
    popover: {
      title: 'Step 3 — Draw Zones',
      description: 'Click "Draw polygon" or "Draw rectangle", then click on the map to trace each restroom boundary. Name the zone, choose its type, and save. A linked Restroom record is created automatically for Restroom-type zones.',
      side: 'left', align: 'start',
    },
  },
  // ── Step 4: Place Devices ─────────────────────────────────────────────────
  {
    element: '[data-tour="sc-device-placement"]',
    route: '/site-config',
    wizardStep: 4,
    roles: [ROLES.VENDOR_ADMIN, ROLES.SUPER_ADMIN, ROLES.REGIONAL_MANAGER, ROLES.VENDOR_MANAGER, ROLES.FACILITY_MANAGER],
    popover: {
      title: 'Step 4 — Place Devices on the Map',
      description: 'Select a registered badge device from the dropdown, then click its physical location on the floor plan. Drop it inside a drawn zone to auto-assign it to that restroom.',
      side: 'left', align: 'start',
    },
  },
  // ── Step 5: Place Gateways ────────────────────────────────────────────────
  {
    element: '[data-tour="sc-gateway-placement"]',
    route: '/site-config',
    wizardStep: 5,
    roles: [ROLES.VENDOR_ADMIN, ROLES.SUPER_ADMIN, ROLES.REGIONAL_MANAGER, ROLES.VENDOR_MANAGER, ROLES.FACILITY_MANAGER],
    popover: {
      title: 'Step 5 — Place Gateways on the Map',
      description: 'Select a LoRaWAN gateway and click its physical location on the floor plan. Gateways receive signals from badge devices and forward them to the network.',
      side: 'left', align: 'start',
    },
  },
  // ── Step 6: Review ────────────────────────────────────────────────────────
  {
    element: '[data-tour="sc-review"]',
    route: '/site-config',
    wizardStep: 6,
    roles: [ROLES.VENDOR_ADMIN, ROLES.SUPER_ADMIN, ROLES.REGIONAL_MANAGER, ROLES.VENDOR_MANAGER, ROLES.FACILITY_MANAGER],
    popover: {
      title: 'Step 6 — Review & Finish',
      description: 'Review every floor, zone, device, and gateway. Delete or unlink items here if needed. Click "Finish & go to dashboard" — your site is live and devices will start sending data.',
      side: 'top', align: 'start',
    },
  },
  {
    element: '[data-tour="gateway-search"]',
    route: '/gateways',
    popover: {
      title: 'Search Gateways',
      description: 'Find registered LoRaWAN gateways by name or EUI. If a gateway goes offline all devices behind it stop sending data.',
      side: 'bottom', align: 'start',
    },
  },
  {
    element: '[data-tour="gateway-table"]',
    route: '/gateways',
    popover: {
      title: 'Gateway List',
      description: 'Name, EUI, site/floor, online status, TTN status, device count, and last-seen time. Eye icon opens the detail drawer.',
      side: 'top', align: 'start',
    },
  },
  {
    element: '[data-tour="device-search"]',
    route: '/devices',
    popover: {
      title: 'Search Devices',
      description: 'Find any badge device by name or Badge ID. These are the physical 3-button hardware installed in each restroom.',
      side: 'bottom', align: 'start',
    },
  },
  {
    element: '[data-tour="device-table"]',
    route: '/devices',
    popover: {
      title: 'Device Registry',
      description: 'Name, Badge ID, site/floor/restroom, battery %, status, health, and last communication. Use "Edit" to assign a device to a restroom.',
      side: 'top', align: 'start',
    },
  },
  {
    element: '[data-tour="restroom-add-btn"]',
    route: '/restrooms',
    popover: {
      title: 'Add a Restroom',
      description: 'Register a new restroom — name, floor, optional zone, and gender. Then assign a badge device from Device Management.',
      side: 'bottom', align: 'end',
    },
  },
  {
    element: '[data-tour="restroom-table"]',
    route: '/restrooms',
    popover: {
      title: 'Restroom Registry',
      description: 'Every restroom with its site, floor, zone, gender, and status. Click any row for the last 20 feedback events and assigned devices.',
      side: 'top', align: 'start',
    },
  },
  {
    element: '[data-tour="alert-tabs"]',
    route: '/alerts',
    popover: {
      title: 'Active Alerts vs History',
      description: '"Active Alerts" = open/assigned/in-progress. "Alert History" = all resolved alerts. Check Active daily.',
      side: 'bottom', align: 'start',
    },
  },
  {
    element: '[data-tour="alert-filters"]',
    route: '/alerts',
    popover: {
      title: 'Alert Filters',
      description: 'Filter by status, priority, site, floor, zone, or device. Use Priority → Critical for the most urgent incidents first.',
      side: 'bottom', align: 'start',
    },
  },
  {
    element: '[data-tour="alert-table"]',
    route: '/alerts',
    popover: {
      title: 'Alert Table',
      description: 'Trigger time, restroom, type, priority, and status per alert. Assign directly from this table and add notes for the audit trail.',
      side: 'top', align: 'start',
    },
  },
  {
    element: '[data-tour="user-role-tabs"]',
    route: '/users',
    roles: [ROLES.VENDOR_ADMIN, ROLES.SUPER_ADMIN],
    popover: {
      title: 'User Role Sections',
      description: 'Users grouped by role. Switch tabs to manage Regional Managers, Vendor Managers, Site Incharges, Facility Managers, and Viewers.',
      side: 'bottom', align: 'start',
    },
  },
  {
    element: '[data-tour="user-add-btn"]',
    route: '/users',
    roles: [ROLES.VENDOR_ADMIN, ROLES.SUPER_ADMIN],
    popover: {
      title: 'Add a User',
      description: 'Create a new user. The role pre-fills from the active tab. Remind users to change their password on first login.',
      side: 'bottom', align: 'end',
    },
  },
  {
    element: '[data-tour="user-table"]',
    route: '/users',
    roles: [ROLES.VENDOR_ADMIN, ROLES.SUPER_ADMIN],
    popover: {
      title: 'User List',
      description: 'Name, email, role, and active/inactive status. Edit to update or Deactivate to suspend access without deleting the account.',
      side: 'top', align: 'start',
    },
  },
  {
    element: '[data-tour="audit-filters"]',
    route: '/audit-history',
    roles: [ROLES.VENDOR_ADMIN, ROLES.SUPER_ADMIN],
    popover: {
      title: 'Audit Log Filters',
      description: 'Filter by module, action type (create/update/delete), or date range to investigate any change.',
      side: 'bottom', align: 'start',
    },
  },
  {
    element: '[data-tour="audit-table"]',
    route: '/audit-history',
    roles: [ROLES.VENDOR_ADMIN, ROLES.SUPER_ADMIN],
    popover: {
      title: 'Audit Trail',
      description: 'Every action by every user — actor, timestamp, module, action, description. Immutable compliance record.',
      side: 'top', align: 'start',
    },
  },
  {
    element: '[data-tour="settings-notifications"]',
    route: '/settings',
    roles: [ROLES.VENDOR_ADMIN, ROLES.SUPER_ADMIN],
    popover: {
      title: 'Teams Notifications',
      description: 'Paste your Microsoft Teams webhook URL here. When an Unhappy alert fires, an instant notification goes to your ops channel.',
      side: 'bottom', align: 'start',
    },
  },
  {
    element: '[data-tour="settings-tour-card"]',
    route: '/settings',
    roles: [ROLES.VENDOR_ADMIN, ROLES.SUPER_ADMIN],
    popover: {
      title: "🎉 You're all set!",
      description: 'Relaunch this tour any time from here or via "Take a tour" in the top bar — great for onboarding new team members.',
      side: 'top', align: 'start',
    },
  },
]

function getStepsForRole(role) {
  return ALL_STEPS.filter((s) => !s.roles || s.roles.includes(role))
}

// ─── Core: run steps one at a time, navigating between pages ─────────────────
export default function ProductTour() {
  const { user, updateUser } = useAuth()
  const navigate = useNavigate()
  const driverRef = useRef(null)
  const savingRef = useRef(false)
  const stepsRef = useRef([])
  const idxRef = useRef(0)
  const activeRef = useRef(false)
  const transitioningRef = useRef(false)

  async function persistStatus(status) {
    if (savingRef.current) return
    savingRef.current = true
    updateUser({ tutorialStatus: status })
    try {
      await api.put('/api/auth/tutorial', { tutorialStatus: status })
    } catch (err) {
      console.warn('ProductTour: persist failed', err)
    } finally {
      savingRef.current = false
    }
  }

  // Navigate to a route and wait for the page to mount
  function goToRoute(route) {
    return new Promise((resolve) => {
      if (!route || window.location.pathname === route) {
        resolve()
        return
      }
      navigate(route)
      setTimeout(resolve, 500)
    })
  }

  // If a step needs a specific wizard step to be active, fire an event
  function activateWizardStep(wizardStep) {
    if (!wizardStep) return Promise.resolve()
    return new Promise((resolve) => {
      window.dispatchEvent(new CustomEvent('srfs-site-config-step', { detail: { step: wizardStep } }))
      setTimeout(resolve, 350)
    })
  }

  // Show a single step at the current index
  async function showStep(idx, steps) {
    if (!activeRef.current) return

    const step = steps[idx]
    if (!step) {
      // Tour complete
      endTour('completed')
      return
    }

    const total = steps.length

    // Navigate to the step's page first
    await goToRoute(step.route)

    if (!activeRef.current) return

    // If this step targets a specific wizard sub-step, activate it
    await activateWizardStep(step.wizardStep)

    if (!activeRef.current) return

    // Destroy any existing driver instance
    if (driverRef.current) {
      try { driverRef.current.destroy() } catch (_) {}
      driverRef.current = null
    }

    // Build a fresh single-step driver
    const d = driver({
      animate: true,
      smoothScroll: true,
      allowClose: false,          // prevent accidental close on overlay click
      overlayOpacity: 0.72,
      stagePadding: 8,
      stageRadius: 10,
      popoverClass: 'srfs-driver-popover',
      showButtons: ['next', 'previous', 'close'],
      nextBtnText: 'Next →',
      prevBtnText: idx === 0 ? '' : '← Back',
      doneBtnText: 'Next →',
      showProgress: true,
      progressText: `Step ${idx + 1} of ${total}`,

      steps: [
        {
          ...(step.element ? { element: step.element } : {}),
          popover: {
            ...step.popover,
            onPopoverRender: (popover) => {
              popover.closeButton.textContent = '×'
              popover.closeButton.setAttribute('aria-label', 'Cancel tour')
              popover.closeButton.setAttribute('title', 'Cancel tour')
              popover.previousButton.textContent = '← Back'
              popover.previousButton.style.display = idx === 0 ? 'none' : ''
              popover.previousButton.disabled = idx === 0
            },
            onNextClick: () => {
              if (!activeRef.current) return
              transitioningRef.current = true
              idxRef.current = idx + 1
              try { d.destroy() } catch (_) {}
              driverRef.current = null
              transitioningRef.current = false
              showStep(idxRef.current, steps)
            },
            onPrevClick: () => {
              if (!activeRef.current) return
              transitioningRef.current = true
              idxRef.current = Math.max(0, idx - 1)
              try { d.destroy() } catch (_) {}
              driverRef.current = null
              transitioningRef.current = false
              showStep(idxRef.current, steps)
            },
            onCloseClick: () => {
              endTour('skipped')
            },
          },
        },
      ],

      onDestroyStarted: () => {
        // Only fires when Driver.js itself initiates destroy (Escape key / overlay)
        // Our manual destroy calls are guarded by activeRef
        if (activeRef.current && !transitioningRef.current) {
          endTour('skipped')
        }
      },
    })

    driverRef.current = d
    d.drive()
  }

  function endTour(status) {
    if (!activeRef.current) return
    activeRef.current = false

    try { driverRef.current?.destroy() } catch (_) {}
    driverRef.current = null

    window.dispatchEvent(new CustomEvent('srfs-tour-state', { detail: { active: false } }))
    document.body.classList.remove('srfs-tour-active')

    persistStatus(status)
    if (status === 'completed') navigate('/dashboard')
  }

  function startTour() {
    if (!user) return
    const steps = getStepsForRole(user.role)
    if (!steps.length) return

    stepsRef.current = steps
    idxRef.current = 0
    activeRef.current = true

    window.dispatchEvent(new CustomEvent('srfs-tour-state', { detail: { active: true } }))
    document.body.classList.add('srfs-tour-active')

    showStep(0, steps)
  }

  useEffect(() => {
    if (!user) return

    function handleRestart() { startTour() }

    // After first-login OnboardingModal closes → auto-start contextual tour
    function handleOnboardingClosed() {
      setTimeout(startTour, 400)
    }

    window.addEventListener('srfs-tour-restart', handleRestart)
    window.addEventListener('srfs-onboarding-closed', handleOnboardingClosed)

    return () => {
      window.removeEventListener('srfs-tour-restart', handleRestart)
      window.removeEventListener('srfs-onboarding-closed', handleOnboardingClosed)
      if (activeRef.current) {
        activeRef.current = false
        try { driverRef.current?.destroy() } catch (_) {}
        driverRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  return null
}
