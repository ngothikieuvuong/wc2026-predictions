"use client";

import { useState } from "react";
import Modal from "@/components/Modal";

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

      {open && (
        <Modal title="📖 Luật chơi" onClose={() => setOpen(false)}>
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
                <h3 className="mb-1 font-bold text-grass">
                  3. Chia thưởng — theo TỪNG TRẬN
                </h3>
                <ul className="list-disc space-y-1 pl-5">
                  <li>
                    <b>Quỹ mỗi trận</b> = số người đoán trận đó × 20.000đ.
                  </li>
                  <li>
                    Quỹ một trận <b>chia đều cho những người đoán trúng đúng trận
                    đó</b>. Bạn chỉ ăn tiền từ trận mình đoán trúng — không lẹm sang
                    trận khác.
                  </li>
                  <li>
                    Trúng <b>nhiều trận</b> → cộng dồn tiền các trận. Đoán <b>trật</b>{" "}
                    → 20.000đ đó nhập vào quỹ trận, cho người trúng trận ấy.
                  </li>
                </ul>

                <h3 className="mb-1 mt-3 font-bold text-grass">
                  4. Quỹ treo (trận chưa ai trúng)
                </h3>
                <ul className="list-disc space-y-1 pl-5">
                  <li>
                    Trận <b>không ai đoán trúng</b> → toàn bộ quỹ trận đó thành{" "}
                    <b>quỹ treo</b>, dồn sang các đợt sau.
                  </li>
                  <li>
                    Khi tới ngày có người trúng, quỹ treo được chia cho{" "}
                    <b>những người trúng</b> hôm đó theo <b>số slot</b> họ đã đặt ở các
                    trận treo (slot × số người × 20.000đ = mức ăn tối đa), <b>ưu tiên
                    trả hết</b>; nếu vượt quỹ treo thì <b>giảm đều</b>.
                  </li>
                  <li>
                    Người <b>đã nhận thưởng</b> trước đó không còn phần trong quỹ treo.
                  </li>
                </ul>

                <div className="mt-2 space-y-3 rounded-xl border border-grass/30 bg-grass/5 p-3 text-[13px]">
                  <p className="text-white/60">
                    Ví dụ một ngày có 2 trận, mỗi trận <b>8 người</b> đoán (160.000đ
                    mỗi trận), kèm <b>quỹ treo 240.000đ</b> từ trước.
                  </p>

                  <div>
                    <p className="mb-1 font-bold text-grass">📌 Trận A — 2 người trúng</p>
                    <p>
                      ba Đức &amp; ba Hiến cùng đoán đúng → quỹ trận 160k{" "}
                      <b>chia đôi = 80.000đ mỗi người</b>.
                    </p>
                  </div>

                  <div>
                    <p className="mb-1 font-bold text-grass">📌 Trận B — 1 người trúng</p>
                    <p>
                      Chỉ Ly đúng → Ly <b>ăn trọn 160.000đ</b> của trận B.
                    </p>
                  </div>

                  <div>
                    <p className="mb-1 font-bold text-grass">📌 Quỹ treo 240k</p>
                    <p>
                      Chia cho người trúng theo slot treo: ba Hiến 2 slot, Ly 3 slot
                      (ba Đức đã nhận thưởng trước → loại) → ba Hiến{" "}
                      <b>96.000đ</b>, Ly <b>144.000đ</b>.
                    </p>
                  </div>

                  <p className="border-t border-white/10 pt-2 text-white/70">
                    → Tổng: ba Đức <b className="text-neon">80.000đ</b>, ba Hiến{" "}
                    <b className="text-neon">176.000đ</b>, Ly{" "}
                    <b className="text-neon">304.000đ</b>.
                  </p>
                </div>
              </section>
            </div>
        </Modal>
      )}
    </>
  );
}
