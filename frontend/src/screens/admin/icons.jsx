import React from 'react'

const Svg = ({ size = 16, className, children, viewBox = '0 0 24 24' }) => (
  <svg
    xmlns='http://www.w3.org/2000/svg'
    width={size}
    height={size}
    viewBox={viewBox}
    fill='none'
    stroke='currentColor'
    strokeWidth='2'
    strokeLinecap='round'
    strokeLinejoin='round'
    className={className}
    aria-hidden='true'
  >
    {children}
  </svg>
)

export const LayoutDashboardIcon = (p) => (
  <Svg {...p}>
    <rect width='7' height='9' x='3' y='3' rx='1' />
    <rect width='7' height='5' x='14' y='3' rx='1' />
    <rect width='7' height='9' x='14' y='12' rx='1' />
    <rect width='7' height='5' x='3' y='16' rx='1' />
  </Svg>
)

export const UsersIcon = (p) => (
  <Svg {...p}>
    <path d='M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2' />
    <circle cx='9' cy='7' r='4' />
    <path d='M22 21v-2a4 4 0 0 0-3-3.87' />
    <path d='M16 3.13a4 4 0 0 1 0 7.75' />
  </Svg>
)

export const PackageIcon = (p) => (
  <Svg {...p}>
    <path d='M16.5 9.4 7.55 4.24' />
    <path d='M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z' />
    <polyline points='3.29 7 12 12 20.71 7' />
    <line x1='12' y1='22' x2='12' y2='12' />
  </Svg>
)

export const ShoppingBagIcon = (p) => (
  <Svg {...p}>
    <path d='M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z' />
    <line x1='3' y1='6' x2='21' y2='6' />
    <path d='M16 10a4 4 0 0 1-8 0' />
  </Svg>
)

export const FlagIcon = (p) => (
  <Svg {...p}>
    <path d='M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z' />
    <line x1='4' y1='22' x2='4' y2='15' />
  </Svg>
)

export const SearchIcon = (p) => (
  <Svg {...p}>
    <circle cx='11' cy='11' r='8' />
    <line x1='21' y1='21' x2='16.65' y2='16.65' />
  </Svg>
)

export const XIcon = (p) => (
  <Svg {...p}>
    <line x1='18' y1='6' x2='6' y2='18' />
    <line x1='6' y1='6' x2='18' y2='18' />
  </Svg>
)

export const ExternalLinkIcon = (p) => (
  <Svg {...p}>
    <path d='M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6' />
    <polyline points='15 3 21 3 21 9' />
    <line x1='10' y1='14' x2='21' y2='3' />
  </Svg>
)

export const MoreHorizontalIcon = (p) => (
  <Svg {...p}>
    <circle cx='12' cy='12' r='1' />
    <circle cx='19' cy='12' r='1' />
    <circle cx='5' cy='12' r='1' />
  </Svg>
)

export const ChevronDownIcon = (p) => (
  <Svg {...p}>
    <polyline points='6 9 12 15 18 9' />
  </Svg>
)

export const RowsComfortableIcon = (p) => (
  <Svg {...p}>
    <rect x='3' y='4' width='18' height='7' rx='1' />
    <rect x='3' y='13' width='18' height='7' rx='1' />
  </Svg>
)

export const RowsCompactIcon = (p) => (
  <Svg {...p}>
    <rect x='3' y='3' width='18' height='4' rx='1' />
    <rect x='3' y='10' width='18' height='4' rx='1' />
    <rect x='3' y='17' width='18' height='4' rx='1' />
  </Svg>
)

export const AlertCircleIcon = (p) => (
  <Svg {...p}>
    <circle cx='12' cy='12' r='10' />
    <line x1='12' y1='8' x2='12' y2='12' />
    <line x1='12' y1='16' x2='12.01' y2='16' />
  </Svg>
)

export const ArrowUpIcon = (p) => (
  <Svg {...p}>
    <line x1='12' y1='19' x2='12' y2='5' />
    <polyline points='5 12 12 5 19 12' />
  </Svg>
)

export const PencilIcon = (p) => (
  <Svg {...p}>
    <path d='M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z' />
  </Svg>
)

export const Trash2Icon = (p) => (
  <Svg {...p}>
    <path d='M3 6h18' />
    <path d='M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6' />
    <path d='M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2' />
    <line x1='10' y1='11' x2='10' y2='17' />
    <line x1='14' y1='11' x2='14' y2='17' />
  </Svg>
)

export const AlertTriangleIcon = (p) => (
  <Svg {...p}>
    <path d='m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z' />
    <line x1='12' y1='9' x2='12' y2='13' />
    <line x1='12' y1='17' x2='12.01' y2='17' />
  </Svg>
)

export const PlusIcon = (p) => (
  <Svg {...p}>
    <line x1='12' y1='5' x2='12' y2='19' />
    <line x1='5' y1='12' x2='19' y2='12' />
  </Svg>
)

export const EyeIcon = (p) => (
  <Svg {...p}>
    <path d='M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z' />
    <circle cx='12' cy='12' r='3' />
  </Svg>
)

export const CheckIcon = (p) => (
  <Svg {...p}>
    <polyline points='20 6 9 17 4 12' />
  </Svg>
)
