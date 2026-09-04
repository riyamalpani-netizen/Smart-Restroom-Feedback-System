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
      description: '<ul><li>Covers every page — Dashboard, Live Feedback, Alerts, Devices, Users and more</li><li>Takes about 2 minutes to complete</li><li>You can relaunch this tour any time from the top bar</li></ul>',
    },
  },
  {
    element: '[data-tour="navbar"]',
    route: '/dashboard',
    popover: {
      title: 'Top Navigation Bar',
      description: '<ul><li>Shows your current page and breadcrumb trail</li><li>Quick-access profile link and logout button</li><li>"Take a tour" button relaunches this walkthrough any time</li></ul>',
      side: 'bottom', align: 'start',
    },
  },
  {
    element: '[data-tour="dashboard-filters"]',
    route: '/dashboard',
    popover: {
      title: 'Dashboard Filters',
      description: '<ul><li>Narrows all KPI cards, charts, and the map to a specific scope</li><li>Select a <strong>Site</strong> first — Floor and Zone cascade automatically</li><li>Clear all filters with the "Clear" button to return to the full view</li></ul>',
      side: 'bottom', align: 'start',
    },
  },
  {
    element: '[data-tour="dashboard-map"]',
    route: '/dashboard',
    popover: {
      title: 'Site Location Map',
      description: '<ul><li>Every configured site is pinned on a live map</li><li>Click a marker to see the site name and location</li><li>Use the filters above to focus the map on a specific site</li></ul>',
      side: 'bottom', align: 'start',
    },
  },
  {
    element: '[data-tour="dashboard-unhappy"]',
    route: '/dashboard',
    popover: {
      title: 'Unhappy Complaints',
      description: '<ul><li>Aggregated list of restrooms with the most recent unhappy feedback</li><li>Acknowledge or Resolve complaints directly from this panel</li><li>Unresolved complaints escalate automatically into active alerts</li></ul>',
      side: 'left', align: 'start',
    },
  },
  {
    element: '[data-tour="dashboard-kpi-cards"]',
    route: '/dashboard',
    popover: {
      title: 'Live KPI Cards',
      description: "<ul><li>Auto-refreshes every 30 seconds</li><li>Shows today's Happy, Unhappy, and Okay feedback counts</li><li>Includes active alert count and overall device health score</li></ul>",
      side: 'bottom', align: 'start',
    },
  },
  {
    element: '[data-tour="dashboard-alerts"]',
    route: '/dashboard',
    popover: {
      title: 'Active Alerts Widget',
      description: '<ul><li>Lists the most urgent open alerts at a glance</li><li>Acknowledge or Resolve alerts directly from this widget</li><li>Go to Alert Management for the full table and filters</li></ul>',
      side: 'top', align: 'start',
    },
  },
  {
    element: '[data-tour="live-feedback-toolbar"]',
    route: '/live-feedback',
    popover: {
      title: 'Live Feedback Filters',
      description: '<ul><li>Filter real-time feedback by type, site, floor, zone, or device</li><li>Updates instantly via Socket.IO — no page refresh needed</li><li>Combine filters to isolate a specific restroom or event type</li></ul>',
      side: 'bottom', align: 'start',
    },
  },
  {
    element: '[data-tour="live-feedback-table"]',
    route: '/live-feedback',
    popover: {
      title: 'Feedback Event Stream',
      description: '<ul><li>Every button press from every badge device appears here in real time</li><li>New rows appear at the top — highlighted red for Unhappy events</li><li>Shows device, restroom, floor, zone, and timestamp per event</li></ul>',
      side: 'top', align: 'start',
    },
  },
  {
    element: '[data-tour="reports-filters"]',
    route: '/reports',
    popover: {
      title: 'Report Filters',
      description: '<ul><li>Choose a date range to scope the report period</li><li>Select report type: Feedback Trends, Alerts, Device Health, or Battery</li><li>Narrow further by site, floor, or restroom</li></ul>',
      side: 'bottom', align: 'start',
    },
  },
  {
    element: '[data-tour="reports-export"]',
    route: '/reports',
    popover: {
      title: 'Export Reports',
      description: '<ul><li>Download the current report as CSV or Excel</li><li>Export reflects your active filters exactly</li><li>Use CSV for custom analysis, Excel for formatted sharing</li></ul>',
      side: 'bottom', align: 'end',
    },
  },
  {
    element: '[data-tour="site-config-wizard"]',
    route: '/site-config',
    roles: [ROLES.VENDOR_ADMIN, ROLES.SUPER_ADMIN, ROLES.REGIONAL_MANAGER, ROLES.VENDOR_MANAGER, ROLES.FACILITY_MANAGER],
    popover: {
      title: 'Site Configuration — 6-Step Wizard',
      description: '<ul><li>Define Site → Floor Plans → Draw Zones → Place Devices → Place Gateways → Review</li><li>Click any step number to jump directly to it</li><li>Progress is saved automatically at each step</li></ul>',
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
      description: '<ul><li>Enter a <strong>Site Name</strong> (e.g. "Pune HQ") and select a Site Type (Office, Hospital…)</li><li>Add the city or location — this appears on all reports and the Floor Map</li><li>Optionally add a description for internal reference</li></ul>',
      side: 'right', align: 'start',
    },
  },
  {
    element: '[data-tour="sc-coordinates"]',
    route: '/site-config',
    roles: [ROLES.VENDOR_ADMIN, ROLES.SUPER_ADMIN, ROLES.REGIONAL_MANAGER, ROLES.VENDOR_MANAGER, ROLES.FACILITY_MANAGER],
    popover: {
      title: 'GPS Coordinates',
      description: '<ul><li>Enter latitude and longitude manually, or use "Save coordinates from address" to auto-fill</li><li>Click "Mark centre on map" to drop a pin visually on the satellite map</li><li>Coordinates anchor your floor plans to real-world geography</li></ul>',
      side: 'top', align: 'start',
    },
  },
  {
    element: '[data-tour="sc-site-preview"]',
    route: '/site-config',
    roles: [ROLES.VENDOR_ADMIN, ROLES.SUPER_ADMIN, ROLES.REGIONAL_MANAGER, ROLES.VENDOR_MANAGER, ROLES.FACILITY_MANAGER],
    popover: {
      title: 'Live Site Preview',
      description: '<ul><li>Updates in real time as you fill in the form</li><li>Shows site name, type, location, and a mini map pin</li><li>When it looks correct, click "Save &amp; Continue →" to proceed</li></ul>',
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
      description: '<ul><li>Click "Upload floor plan" to add a PNG or JPG image of the floor</li><li>Drag the ✥ handle to move the plan, use corner handles to resize</li><li>Use the rotation slider to align it precisely over the satellite map</li></ul>',
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
      description: '<ul><li>Click "Draw polygon" or "Draw rectangle", then click the map to trace the boundary</li><li>Name the zone and choose its type (Restroom, Corridor, etc.)</li><li>A Restroom record is created automatically for Restroom-type zones</li></ul>',
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
      description: '<ul><li>Select a registered badge device from the dropdown</li><li>Click its physical location on the floor plan to drop it</li><li>Dropping inside a drawn zone auto-assigns it to that restroom</li></ul>',
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
      description: '<ul><li>Select a LoRaWAN gateway from the dropdown</li><li>Click its physical location on the floor plan to place it</li><li>Gateways receive signals from badge devices and forward them to the network</li></ul>',
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
      description: '<ul><li>Review every floor, zone, device, and gateway in one place</li><li>Delete or unlink any item here if needed before going live</li><li>Click "Finish &amp; go to dashboard" — devices will start sending data immediately</li></ul>',
      side: 'top', align: 'start',
    },
  },
  {
    element: '[data-tour="gateway-search"]',
    route: '/gateways',
    popover: {
      title: 'Search Gateways',
      description: '<ul><li>Find registered LoRaWAN gateways by name or EUI</li><li>If a gateway goes offline, all devices behind it stop sending data</li><li>Use this to quickly check a specific gateway&#39;s status</li></ul>',
      side: 'bottom', align: 'start',
    },
  },
  {
    element: '[data-tour="gateway-table"]',
    route: '/gateways',
    popover: {
      title: 'Gateway List',
      description: '<ul><li>Shows name, EUI, site/floor, online status, and TTN status</li><li>Device count and last-seen timestamp per gateway</li><li>Eye icon opens the detail drawer for full information</li></ul>',
      side: 'top', align: 'start',
    },
  },
  {
    element: '[data-tour="device-search"]',
    route: '/devices',
    popover: {
      title: 'Search Devices',
      description: '<ul><li>Find any badge device by name or Badge ID</li><li>These are the physical 3-button hardware units installed in restrooms</li><li>Use search to locate a specific device before editing or reassigning it</li></ul>',
      side: 'bottom', align: 'start',
    },
  },
  {
    element: '[data-tour="device-table"]',
    route: '/devices',
    popover: {
      title: 'Device Registry',
      description: '<ul><li>Shows name, Badge ID, site/floor/restroom, and battery %</li><li>Displays status, health score, and last communication time</li><li>Use "Edit" to assign a device to a different restroom</li></ul>',
      side: 'top', align: 'start',
    },
  },
  {
    element: '[data-tour="restroom-add-btn"]',
    route: '/restrooms',
    popover: {
      title: 'Add a Restroom',
      description: '<ul><li>Register a new restroom with a name, floor, and gender</li><li>Optionally link it to an existing zone</li><li>Assign a badge device from Device Management after creation</li></ul>',
      side: 'bottom', align: 'end',
    },
  },
  {
    element: '[data-tour="restroom-table"]',
    route: '/restrooms',
    popover: {
      title: 'Restroom Registry',
      description: '<ul><li>Lists every restroom with its site, floor, zone, gender, and status</li><li>Click any row to view the last 20 feedback events</li><li>Shows assigned devices per restroom inline</li></ul>',
      side: 'top', align: 'start',
    },
  },
  {
    element: '[data-tour="alert-tabs"]',
    route: '/alerts',
    popover: {
      title: 'Active Alerts vs History',
      description: '<ul><li><strong>Active Alerts</strong> — open, assigned, or in-progress incidents</li><li><strong>Alert History</strong> — all fully resolved alerts</li><li>Check the Active tab daily to stay on top of issues</li></ul>',
      side: 'bottom', align: 'start',
    },
  },
  {
    element: '[data-tour="alert-filters"]',
    route: '/alerts',
    popover: {
      title: 'Alert Filters',
      description: '<ul><li>Filter by status, priority, site, floor, zone, or device</li><li>Use Priority → Critical to surface the most urgent incidents first</li><li>Combine filters to narrow down alerts for a specific area</li></ul>',
      side: 'bottom', align: 'start',
    },
  },
  {
    element: '[data-tour="alert-table"]',
    route: '/alerts',
    popover: {
      title: 'Alert Table',
      description: '<ul><li>Shows trigger time, restroom, alert type, priority, and current status</li><li>Assign alerts directly from this table to a team member</li><li>Add notes to build an audit trail for each incident</li></ul>',
      side: 'top', align: 'start',
    },
  },
  {
    element: '[data-tour="user-role-tabs"]',
    route: '/users',
    roles: [ROLES.VENDOR_ADMIN, ROLES.SUPER_ADMIN],
    popover: {
      title: 'User Role Sections',
      description: '<ul><li>Users are grouped by role for easy management</li><li>Switch tabs to manage Regional Managers, Vendor Managers, Site Incharges, Facility Managers, and Viewers</li><li>Each role has a different level of access across the system</li></ul>',
      side: 'bottom', align: 'start',
    },
  },
  {
    element: '[data-tour="user-add-btn"]',
    route: '/users',
    roles: [ROLES.VENDOR_ADMIN, ROLES.SUPER_ADMIN],
    popover: {
      title: 'Add a User',
      description: '<ul><li>Create a new user — role pre-fills from the active tab</li><li>Set a temporary password and remind the user to change it on first login</li><li>Assign the user to specific sites if their role requires it</li></ul>',
      side: 'bottom', align: 'end',
    },
  },
  {
    element: '[data-tour="user-table"]',
    route: '/users',
    roles: [ROLES.VENDOR_ADMIN, ROLES.SUPER_ADMIN],
    popover: {
      title: 'User List',
      description: '<ul><li>Shows name, email, role, and active/inactive status</li><li>Edit to update details or change role assignments</li><li>Deactivate to suspend access without permanently deleting the account</li></ul>',
      side: 'top', align: 'start',
    },
  },
  {
    element: '[data-tour="audit-filters"]',
    route: '/audit-history',
    roles: [ROLES.VENDOR_ADMIN, ROLES.SUPER_ADMIN],
    popover: {
      title: 'Audit Log Filters',
      description: '<ul><li>Filter by module (Sites, Devices, Users, etc.)</li><li>Filter by action type: create, update, or delete</li><li>Set a date range to investigate changes in a specific window</li></ul>',
      side: 'bottom', align: 'start',
    },
  },
  {
    element: '[data-tour="audit-table"]',
    route: '/audit-history',
    roles: [ROLES.VENDOR_ADMIN, ROLES.SUPER_ADMIN],
    popover: {
      title: 'Audit Trail',
      description: '<ul><li>Every action by every user is logged here</li><li>Shows actor, timestamp, module, action type, and description</li><li>Immutable compliance record — entries cannot be edited or deleted</li></ul>',
      side: 'top', align: 'start',
    },
  },
  {
    element: '[data-tour="settings-notifications"]',
    route: '/settings',
    roles: [ROLES.VENDOR_ADMIN, ROLES.SUPER_ADMIN],
    popover: {
      title: 'Teams Notifications',
      description: '<ul><li>Paste your Microsoft Teams webhook URL to enable instant alerts</li><li>A notification is sent to your ops channel whenever an Unhappy alert fires</li><li>Test the webhook with the "Send test" button after saving</li></ul>',
      side: 'bottom', align: 'start',
    },
  },
  {
    element: '[data-tour="settings-tour-card"]',
    route: '/settings',
    roles: [ROLES.VENDOR_ADMIN, ROLES.SUPER_ADMIN],
    popover: {
      title: "🎉 You're all set!",
      description: '<ul><li>Your system is fully configured and ready to go</li><li>Relaunch this tour any time from this card or via "Take a tour" in the top bar</li><li>Great for onboarding new team members quickly</li></ul>',
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
      disableButtons: [],
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
              popover.closeButton.style.display = 'grid'
              popover.closeButton.setAttribute('aria-label', 'Cancel tour')
              popover.closeButton.setAttribute('title', 'Cancel tour')
              popover.previousButton.textContent = '← Back'
              popover.previousButton.style.display = idx === 0 ? 'none' : ''
              popover.previousButton.disabled = false
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
