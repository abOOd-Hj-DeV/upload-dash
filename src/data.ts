export type Session = {
  name: string
  date: string
  time: string
  status: 'ready' | 'canceled' | 'unsure'
  image: string
  crop?: string
}

export const sessions: Session[] = [
  {
    name: 'Saad Alsheikh Ali',
    date: '14 Apr 2026',
    time: '09:12',
    status: 'ready',
    image: 'dashboard-imgContainer1.png',
    crop: 'portrait',
  },
  {
    name: 'Ahmad Swayed',
    date: '15 Apr 2026',
    time: '11:45',
    status: 'ready',
    image: 'dashboard-imgContainer2.png',
    crop: 'portrait',
  },
  {
    name: 'Sara Muhammad',
    date: '16 Apr 2026',
    time: '08:30',
    status: 'canceled',
    image: 'dashboard-imgContainer3.png',
  },
  {
    name: 'Khaled Aljabri',
    date: '17 Apr 2026',
    time: '14:00',
    status: 'unsure',
    image: 'dashboard-imgContainer4.png',
    crop: 'khaled',
  },
  {
    name: 'Jad Matcha',
    date: '18 Apr 2026',
    time: '10:15',
    status: 'unsure',
    image: 'dashboard-imgContainer4.png',
    crop: 'jad',
  },
  {
    name: 'Marwan Al Salem',
    date: '19 Apr 2026',
    time: '09:00',
    status: 'ready',
    image: 'dashboard-imgContainer5.png',
  },
  {
    name: 'Fahad Al Ali',
    date: '20 Apr 2026',
    time: '13:30',
    status: 'ready',
    image: 'dashboard-imgContainer6.png',
    crop: 'fahad',
  },
]

export const metrics = [
  { label: 'Hours this month', value: 33, change: '+23%', icon: 'dashboard-imgClockThree.svg' },
  {
    label: 'Unread Messages',
    value: 8,
    change: '+14%',
    icon: 'dashboard-imgIconGlass.svg',
    glass: true,
  },
  {
    label: 'Sessions this week',
    value: 12,
    change: '+33%',
    icon: 'dashboard-imgIcon3.svg',
    negative: true,
  },
  { label: 'Active users', value: 77, change: '+33%', icon: 'dashboard-imgIcon4.svg' },
]

export const menu = [
  { label: 'Dashboard', icon: 'dashboard-imgDashboardIcon.svg' },
  { label: 'Patients', icon: 'dashboard-imgSquareUserCheck.svg' },
  { label: 'Sessions', icon: 'dashboard-imgCalendarAlt.svg' },
  { label: 'Messages', icon: 'dashboard-imgMessageCircleLinesAlt.svg', badge: 5 },
  { label: 'Additional Content', icon: 'dashboard-imgStars.svg' },
  { label: 'Wallet', icon: 'dashboard-imgWallet.svg' },
]

export const notifications = [
  {
    id: 1,
    title: 'Dr. Harper scheduled',
    detail: 'a new appointment: "Mindfulness Check-in."',
    time: '20 min ago',
    description: 'Added to your calendar for Tuesday 2:00 PM.',
    image: 'notification-imgImage.png',
    icon: 'notification-imgHeroiconsMiniVideoCamera.svg',
  },
  {
    id: 2,
    title: 'Client shared a progress note',
    detail: 'of "Cognitive Behavioral Therapy."',
    time: '35 min ago',
    description: 'Notes and feedback are now available.',
    image: 'notification-imgImage1.png',
    icon: 'notification-imgHeroiconsMiniDocumentText.svg',
  },
  {
    id: 3,
    title: 'Session transcript',
    detail: 'for "Anxiety Management Session #3" is ready.',
    time: '10 min ago',
    description: 'You can review or highlight key insights.',
    action: 'Open Transcript',
    image: 'notification-imgImage2.png',
    icon: 'notification-imgHeroiconsMiniSparkles.svg',
  },
  {
    id: 4,
    title: 'Client mentioned you',
    detail: 'in "Weekly Therapy Review."',
    time: '15 min ago',
    description: '@harper please confirm the treatment plan updates.',
    image: 'notification-imgImage3.png',
    icon: 'notification-imgHeroiconsMiniChatBubbleOvalLeft.svg',
  },
  {
    id: 5,
    title: 'Alex invited you',
    detail: 'to collaborate on client notes in folder "Session Summaries."',
    time: '25 min ago',
    description: 'You can now view and edit shared client files.',
    action: 'Accept',
    image: 'notification-imgImage4.png',
    icon: 'notification-imgHeroiconsMiniFolder.svg',
  },
  {
    id: 6,
    title: 'Dr. Lee assigned you',
    detail: 'a new task: "Review client progress reports."',
    time: '40 min ago',
    description: 'Due Monday, Nov 6th.',
    action: 'View Task',
    image: 'notification-imgImage.png',
    icon: 'notification-imgHeroiconsMiniQueueList.svg',
  },
]
