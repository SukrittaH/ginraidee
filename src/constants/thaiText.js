// Thai language translations for the app

export const THAI_TEXT = {
  // Common
  cancel: 'ยกเลิก',
  save: 'บันทึก',
  done: 'เสร็จสิ้น',
  add: 'เพิ่ม',
  back: 'กลับ',

  // Inventory Screen
  inventoryTitle: 'คลังอาหาร',
  dueDate: 'วันหมดอายุ',

  // Filters
  all: 'ทั้งหมด',
  starred: 'รายการโปรด',
  dueSoon: 'ใกล้หมดอายุ',
  pastDue: 'หมดอายุแล้ว',

  // Food Categories
  fruits: 'ผลไม้',
  vegetables: 'ผัก',
  dairy: 'นม',
  meat: 'เนื้อสัตว์',
  grains: 'เมล็ดพืช',
  snacks: 'ขนม',

  // Add Item Modal
  addNewItem: 'เพิ่มรายการใหม่',
  itemName: 'ชื่ออาหาร',
  enterItemName: 'กรอกชื่ออาหาร',
  category: 'หมวดหมู่',
  quantity: 'จำนวน',
  selectDate: 'เลือกวันที่',
  quickSelect: 'เลือกเร็ว:',

  // Quick date options
  today: 'วันนี้',
  tomorrow: 'พรุ่งนี้',
  threeDays: '3 วัน',
  oneWeek: '1 สัปดาห์',

  // Status messages
  freshForToday: 'สดใหม่วันนี้',
  expiresToday: 'หมดอายุวันนี้',
  expiresInDays: (days) => `หมดอายุใน ${days} วัน`,
  pastDueDate: 'เลยวันหมดอายุ',
  daysOverdue: (days) => `เลยมา ${Math.abs(days)} วัน`,
  expiresTomorrow: 'หมดอายุพรุ่งนี้',

  // Date Detail Modal
  itemsForDate: 'รายการในวันนี้',
  itemCount: (count) => `${count} รายการ`,
  noItemsForDate: 'ไม่มีรายการในวันนี้',
  noItemsExpire: 'ไม่มีอาหารหมดอายุในวันนี้',

  // Validation messages
  errorTitle: 'ข้อผิดพลาด',
  pleaseEnterItemName: 'กรุณากรอกชื่ออาหาร',
  pleaseSelectCategory: 'กรุณาเลือกหมวดหมู่',

  // Thai months
  months: [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน',
    'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม',
    'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ],

  // Thai short days
  shortDays: ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'],

  // Thai full days
  fullDays: [
    'วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ',
    'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์'
  ],
};
