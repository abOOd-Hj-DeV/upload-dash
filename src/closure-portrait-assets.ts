type ReferenceFrame = {
  nodeId: string
  file: string
  viewport: readonly [width: number, height: number]
}

type Portrait = {
  image: string
  crop?: 'portrait' | 'khaled' | 'jad' | 'fahad'
  artwork: 'photo' | 'masked-avatar'
  target: {
    row: number
    name: string
    sessionId?: string
    amount?: number
    date?: string
  }
  source: {
    kind: 'existing-asset' | 'original-avatar-crop'
    frame: ReferenceFrame
    // Native original coordinates: x, y, width, height; not export-scaled bounds.
    rectangle: readonly [number, number, number, number]
    asset?: string
    sha256?: string
  }
}

const walletFrame: ReferenceFrame = {
  nodeId: '1:21198',
  file: 'frame-1-21198.png',
  viewport: [1440, 774],
}
const sessionsFrame: ReferenceFrame = {
  nodeId: '1:29046',
  file: 'frame-1-29046.png',
  viewport: [1440, 900],
}
const sessionsPhoneFrame: ReferenceFrame = {
  nodeId: '1:30405',
  file: 'frame-1-30405.png',
  viewport: [370, 900],
}

const wallet: readonly Portrait[] = [
  {
    image: 'part3-walletAvatar.png',
    artwork: 'photo',
    target: { row: 1, name: 'Sarah Ali', amount: 300, date: '2024-05-20' },
    source: {
      kind: 'existing-asset',
      asset: 'part3-walletAvatar.png',
      frame: walletFrame,
      rectangle: [306, 375, 42, 44],
    },
  },
  {
    image: 'closure-portrait-wallet-ahmed-mohammed.png',
    artwork: 'masked-avatar',
    target: { row: 2, name: 'Ahmed Mohammed', amount: 200, date: '2024-05-20' },
    source: {
      kind: 'original-avatar-crop',
      frame: walletFrame,
      rectangle: [306, 428, 42, 44],
      sha256: '90acb4f23415c66a05bc74f0bac843b14a45025099db6d6d5436bed302f7f649',
    },
  },
  {
    image: 'closure-portrait-wallet-sarah-khalid.png',
    artwork: 'masked-avatar',
    target: { row: 3, name: 'Sarah Khalid', amount: 100, date: '2024-05-17' },
    source: {
      kind: 'original-avatar-crop',
      frame: walletFrame,
      rectangle: [306, 478, 42, 44],
      sha256: 'ae799f80c6624292a431707596f98c81d3a480b2b8ac82a1b952bc0741a0820f',
    },
  },
  {
    image: 'closure-portrait-wallet-omar-youssef-200.png',
    artwork: 'masked-avatar',
    target: { row: 4, name: 'Omar Youssef', amount: 200, date: '2024-05-16' },
    source: {
      kind: 'original-avatar-crop',
      frame: walletFrame,
      rectangle: [306, 528, 42, 44],
      sha256: '2019ddb0e4c352d052fafc9412089e464611be743455f79f9bb5a714478fb034',
    },
  },
  {
    image: 'closure-portrait-wallet-omar-youssef-400.png',
    artwork: 'masked-avatar',
    target: { row: 5, name: 'Omar Youssef', amount: 400, date: '2024-05-16' },
    source: {
      kind: 'original-avatar-crop',
      frame: walletFrame,
      rectangle: [306, 578, 42, 44],
      sha256: '4d1adfdef1d0d7ab7e45e4342da66a340c299f53fb3faebce92fd3251aa87f7c',
    },
  },
]

function sessionPortrait(
  row: number,
  name: string,
  image: string,
  crop?: Portrait['crop'],
): Portrait {
  return {
    image,
    ...(crop ? { crop } : {}),
    artwork: 'photo',
    target: { row, name, sessionId: `session-${row - 1}` },
    source: {
      kind: 'existing-asset',
      asset: image,
      frame: sessionsFrame,
      rectangle: [306, 228 + (row - 1) * 59, 42, 44],
    },
  }
}

const desktopTablet = [
  sessionPortrait(1, 'Saad Alsheikh Ali', 'dashboard-imgContainer1.png', 'portrait'),
  sessionPortrait(2, 'Ahmad Swayed', 'dashboard-imgContainer2.png', 'portrait'),
  sessionPortrait(3, 'Sara Muhammad', 'dashboard-imgContainer3.png'),
  sessionPortrait(4, 'Khaled Aljabri', 'dashboard-imgContainer4.png', 'khaled'),
  sessionPortrait(5, 'Jad Matcha', 'dashboard-imgContainer4.png', 'jad'),
  sessionPortrait(6, 'Marwan Al Salem', 'part2-07-imgContainer5.png'),
  sessionPortrait(7, 'Fahad Al Ali', 'part2-07-imgContainer6.png'),
  sessionPortrait(8, 'Lina Haddad', 'part2-07-imgContainer7.png'),
  sessionPortrait(9, 'Omar Nasser', 'part2-07-imgContainer8.png'),
  sessionPortrait(10, 'Noor Al-Khatib', 'part2-07-imgContainer9.png'),
  sessionPortrait(11, 'Noor Al-Khatib', 'part2-07-imgContainer10.png'),
]

const phone = desktopTablet.slice(0, 7).map((portrait, index): Portrait => {
  const phonePhoto =
    index === 5
      ? { image: 'dashboard-imgContainer5.png' }
      : index === 6
        ? { image: 'dashboard-imgContainer6.png', crop: 'fahad' as const }
        : { image: portrait.image, crop: portrait.crop }
  return {
    ...portrait,
    ...phonePhoto,
    source: {
      kind: 'existing-asset',
      asset: phonePhoto.image,
      frame: sessionsPhoneFrame,
      rectangle: [16, [276, 371, 466, 557, 648, 739, 830][index], 42, 44],
    },
  }
})

// Demo/reference artwork only. Does not replace live clinical or financial photos.
export const closurePortraitAssets = {
  wallet: {
    earnings: wallet,
    // ATM rows share these five identities on tablet/phone; desktop stays Sarah Ali.
    responsiveWithdrawals: wallet.map((portrait) => ({
      ...portrait,
      target: { ...portrait.target, name: 'ATM Withdrawal' },
    })),
    cropRendering: {
      width: 42,
      height: 44,
      includesBorderAndMask: true,
      additionalBorder: 0,
    },
    // Exact RGBA equality of all five 42x44 avatars, independently checked locally.
    equivalentOriginals: [
      { nodeId: '1:21695', x: 116, y: [375, 428, 478, 528, 578] },
      { nodeId: '1:18994', x: 116, y: [542, 595, 645, 695, 745] },
      { nodeId: '1:19238', x: 116, y: [526, 579, 629, 679, 729] },
      { nodeId: '1:20077', x: 28, y: [568, 630, 689, 747, 805] },
      { nodeId: '1:20245', x: 28, y: [604, 666, 725, 783, 841] },
    ],
  },
  sessions: {
    // Existing Avatar supports the crop values; do not discard composite crops.
    desktopTablet,
    // Only seven rows are visible in 1:30405. No claim about unseen phone rows.
    phone,
    desktopTabletOriginals: ['1:29046', '1:29593', '1:29854'],
  },
} as const
