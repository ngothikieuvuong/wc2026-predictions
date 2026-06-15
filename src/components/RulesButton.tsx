"use client";

import { useState } from "react";
import { createPortal } from "react-dom";

export default function RulesButton({
  className = "btn-ghost",
  children = "📖 Luật chơi",
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button className={className} onClick={() => setOpen(true)}>
        {children}
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
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
                    Chỉ những trận <b>Ban tổ chức mở cho đoán</b> mới hiện trong danh
                    sách chọn.
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
                    <b>Trận thuộc ngày nào:</b> trận đá <b>trước 21h</b> tính vào ngày
                    đó; <b>từ 21h trở đi</b> tính sang <b>ngày hôm sau</b>.
                  </li>
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
                  <li>
                    Quỹ một ngày được <b>chốt ngay sau khi trận sau cùng (trong số
                    các trận được mở cho đoán của ngày đó) kết thúc</b> — không phải
                    chờ tới cuối ngày.
                  </li>
                </ul>

                <div className="mt-2 rounded-xl border border-grass/30 bg-grass/5 p-3 text-[13px]">
                  <p className="mb-1 font-bold text-grass">📌 Ví dụ cho dễ hiểu</p>
                  <ul className="space-y-1.5">
                    <li>
                      <b>Ngày 1:</b> cả nhà góp <b>100.000đ</b> nhưng{" "}
                      <b>không ai trúng</b> → 100.000đ <b>treo</b> lại.
                    </li>
                    <li>
                      <b>Ngày 2:</b> cả nhà góp thêm <b>60.000đ</b>. Chương{" "}
                      <b>đoán trúng</b> (Chương có chơi cả ngày 1 và 2).
                    </li>
                    <li>
                      → Chương nhận <b>60.000đ</b> (quỹ ngày 2) <b>+ 100.000đ</b>{" "}
                      (quỹ treo ngày 1 vì Chương có chơi ngày 1) ={" "}
                      <b className="text-neon">160.000đ</b> 🎉
                    </li>
                    <li className="text-white/50">
                      Nếu ngày 1 Chương <b>không chơi</b> → chỉ nhận 60.000đ, còn
                      100.000đ ngày 1 <b>tiếp tục treo</b>.
                    </li>
                  </ul>

                  <p className="mb-1 mt-3 font-bold text-grass">
                    📌 Trúng nhiều tỉ số = chia nhiều hơn
                  </p>
                  <p className="mb-1.5">
                    Mỗi tỉ số đoán trúng tính là <b>1 slot trúng</b>. Quỹ của ngày
                    chia theo <b>tổng số slot trúng</b>.
                  </p>
                  <ul className="space-y-1.5">
                    <li>
                      VD ngày đó quỹ <b>90.000đ</b>. Chương trúng <b>2 trận</b> (2
                      slot), Vương trúng <b>1 trận</b> (1 slot) → tổng <b>3 slot</b>.
                    </li>
                    <li>
                      → Chương = 90.000 × 2/3 ={" "}
                      <b className="text-neon">60.000đ</b>; Vương = 90.000 × 1/3 ={" "}
                      <b className="text-neon">30.000đ</b>.
                    </li>
                  </ul>
                </div>
              </section>

              <section>
                <h3 className="mb-1 font-bold text-grass">4. Xem & tham khảo</h3>
                <ul className="list-disc space-y-1 pl-5">
                  <li>
                    Tỉ số <b>tự cập nhật khi mở lại / làm mới trang</b> — không cần
                    bấm gì.
                  </li>
                  <li>
                    Trang chủ hiện các trận <b>đang diễn ra</b> kèm tỉ số trực tiếp.
                  </li>
                  <li>
                    Bấm vào một trận để xem: <b>hạng FIFA</b>, đội hình dự kiến, cầu
                    thủ bị treo giò; <b>trước trận</b> có tỉ lệ tham khảo; <b>khi đang
                    đá</b> hiện tỉ số trực tiếp + diễn biến (bàn thắng, thẻ).
                  </li>
                  <li>
                    Ở tab <b>Mọi người</b>, <b>nhấn giữ</b> một lượt đoán để thả cảm
                    xúc.
                  </li>
                  <li>
                    Xem ai đang lời/lỗ ở tab <b>Tổng kết</b> — bấm vào <b>tên</b> để
                    xem lịch sử dự đoán của người đó.
                  </li>
                </ul>
              </section>
            </div>

            <button className="btn mt-4 w-full" onClick={() => setOpen(false)}>
              Đã hiểu
            </button>
          </div>
        </div>,
          document.body
        )}
    </>
  );
}
