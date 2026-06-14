"use client";

import { useState } from "react";

export default function RulesButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button className="btn-ghost" onClick={() => setOpen(true)}>
        📖 Luật chơi
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="card max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-b-none sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xl font-bold">📖 Luật chơi</h2>
              <button
                className="text-2xl leading-none text-white/50 hover:text-white"
                onClick={() => setOpen(false)}
                aria-label="Đóng"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-sm leading-relaxed text-white/80">
              <section>
                <h3 className="mb-1 font-bold text-grass">1. Dự đoán thế nào?</h3>
                <ul className="list-disc space-y-1 pl-5">
                  <li>
                    Vào tab <b>Đoán</b> → chọn tên (hoặc thêm tên mới) → chọn trận →
                    nhập tỉ số (đội nhà : đội khách) → <b>Chốt lượt đoán</b>.
                  </li>
                  <li>
                    Mỗi lượt đoán <b>góp 20.000đ</b> vào quỹ. Đoán được nhiều trận —
                    mỗi trận một lượt.
                  </li>
                  <li>
                    Mỗi người chỉ đoán <b>1 lần/trận</b>. Dự đoán <b>đóng khi trận
                    bắt đầu</b>.
                  </li>
                </ul>
              </section>

              <section>
                <h3 className="mb-1 font-bold text-grass">2. Trúng thế nào?</h3>
                <ul className="list-disc space-y-1 pl-5">
                  <li>
                    Đoán <b>đúng y hệt</b> tỉ số cuối trận (đúng số bàn của cả hai
                    đội) thì trúng.
                  </li>
                  <li>
                    VD: đoán <b>Tây Ban Nha 3–0</b>, trận kết thúc đúng 3–0 → trúng.
                    Nếu là 2–0 hay 3–1 → trượt.
                  </li>
                </ul>
              </section>

              <section>
                <h3 className="mb-1 font-bold text-grass">
                  3. Chia quỹ thế nào? (theo ngày)
                </h3>
                <ul className="list-disc space-y-1 pl-5">
                  <li>
                    Quỹ mỗi ngày = số lượt đoán trong ngày × 20.000đ.
                  </li>
                  <li>
                    Tính <b>theo từng ngày</b>. Ngày có người trúng → chia quỹ ngày
                    đó cho người trúng, <b>theo số lượt trúng</b> (trúng nhiều trận
                    trong ngày thì phần nhiều hơn).
                  </li>
                  <li>
                    <b>Cộng dồn:</b> ngày không ai trúng thì quỹ <b>treo lại</b>. Khi
                    có người trúng ở ngày sau, người đó <b>hốt thêm</b> quỹ treo của
                    những ngày họ <b>đã tham gia</b> (chia theo tổng lượt họ đặt ở các
                    ngày đó). Ngày treo mà người trúng không tham gia → <b>vẫn treo</b>
                    cho lần sau.
                  </li>
                </ul>
              </section>

              <section>
                <h3 className="mb-1 font-bold text-grass">4. Tham khảo</h3>
                <ul className="list-disc space-y-1 pl-5">
                  <li>Kết quả các trận tự cập nhật theo lịch chính thức.</li>
                  <li>
                    Khi chọn trận, app gợi ý <b>đội nào mạnh hơn</b> (theo hạng FIFA)
                    để bạn tham khảo — chỉ mang tính tham khảo.
                  </li>
                  <li>
                    Xem ai đang lời/lỗ ở tab <b>Tổng kết</b>, ai đoán gì ở tab{" "}
                    <b>Mọi người</b>.
                  </li>
                </ul>
              </section>
            </div>

            <button className="btn mt-4 w-full" onClick={() => setOpen(false)}>
              Đã hiểu
            </button>
          </div>
        </div>
      )}
    </>
  );
}
