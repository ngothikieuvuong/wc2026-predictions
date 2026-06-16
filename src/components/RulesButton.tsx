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
                <h3 className="mb-1 font-bold text-grass">1. Cách chơi</h3>
                <ul className="list-disc space-y-1 pl-5">
                  <li>
                    Vào tab <b>Đoán</b> → chọn tên → chọn trận → nhập tỉ số (đội nhà :
                    đội khách) → <b>Chốt lượt đoán</b>.
                  </li>
                  <li>
                    Mỗi lượt đoán <b>góp 20.000đ</b> vào quỹ. Mỗi người chỉ đoán{" "}
                    <b>1 lần/trận</b>, và <b>đóng khi trận bắt đầu</b>.
                  </li>
                  <li>
                    <b>Đoán càng nhiều trận → cơ hội trúng càng cao</b> (mỗi trận một
                    lượt, góp thêm 20.000đ).
                  </li>
                </ul>
              </section>

              <section>
                <h3 className="mb-1 font-bold text-grass">2. Thế nào là trúng?</h3>
                <ul className="list-disc space-y-1 pl-5">
                  <li>
                    Đoán <b>đúng y hệt tỉ số cuối trận</b> (đúng số bàn của cả hai
                    đội) thì trúng.
                  </li>
                  <li>
                    VD: đoán <b>3–0</b>, trận kết thúc đúng <b>3–0</b> → trúng. Nếu là
                    2–0 hay 3–1 → trượt.
                  </li>
                </ul>
              </section>

              <section>
                <h3 className="mb-1 font-bold text-grass">3. Chia thưởng (theo ngày)</h3>
                <ul className="list-disc space-y-1 pl-5">
                  <li>
                    Quỹ mỗi ngày = <b>số lượt đoán trong ngày × 20.000đ</b>.
                  </li>
                  <li>
                    Chia cho người trúng <b>theo số tỉ số trúng</b>: mỗi tỉ số trúng =
                    <b> 1 phần</b>. Trúng nhiều tỉ số → được nhiều phần hơn.
                  </li>
                  <li>
                    <b>Cộng dồn:</b> ngày không ai trúng thì quỹ <b>treo lại</b> và
                    dồn sang ngày sau cho tới khi có người trúng.
                  </li>
                  <li>
                    <b>Giới hạn “ăn trọn”:</b> mỗi người có <b>mức ăn tối đa</b> tùy số
                    slot đã chơi và số người chơi — <b>chơi càng nhiều, trần càng cao</b>.
                    Nếu người trúng không ôm hết quỹ (vd chỉ chơi 1–2 trận mà quỹ treo
                    lớn), phần <b>dư được hoàn lại cho mọi người theo số slot</b> đã đặt.
                    → <b>Quỹ luôn chia hết</b>, không ai chơi ít mà ăn trọn jackpot.
                  </li>
                </ul>

                <div className="mt-2 space-y-3 rounded-xl border border-grass/30 bg-grass/5 p-3 text-[13px]">
                  <div>
                    <p className="mb-1 font-bold text-grass">
                      📌 VD 1 — chia theo số tỉ số trúng
                    </p>
                    <p>
                      Ngày đó quỹ <b>90.000đ</b>, có 2 người trúng: <b>A trúng 1</b> tỉ
                      số, <b>B trúng 2</b> tỉ số → tổng <b>3 phần</b>.
                    </p>
                    <p className="mt-1">
                      → A = 90.000 × 1/3 = <b className="text-neon">30.000đ</b>; B =
                      90.000 × 2/3 = <b className="text-neon">60.000đ</b>.
                    </p>
                  </div>

                  <div>
                    <p className="mb-1 font-bold text-grass">
                      📌 VD 2 — cộng dồn quỹ treo
                    </p>
                    <p>
                      <b>Ngày 1:</b> cả nhà góp <b>100.000đ</b> nhưng không ai trúng →{" "}
                      <b>treo</b>.
                    </p>
                    <p>
                      <b>Ngày 2:</b> góp thêm <b>60.000đ</b>, Chương trúng (Chương có
                      chơi cả 2 ngày) → nhận <b>60.000đ</b> (ngày 2) <b>+ 100.000đ</b>{" "}
                      (quỹ treo ngày 1) = <b className="text-neon">160.000đ</b> 🎉
                    </p>
                    <p className="mt-1 text-white/50">
                      Nếu ngày 1 Chương không chơi → chỉ nhận 60.000đ, 100.000đ ngày 1
                      vẫn treo.
                    </p>
                  </div>
                </div>
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
