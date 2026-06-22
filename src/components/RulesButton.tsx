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
                    Quỹ một trận <b>chia đều cho những người đoán trúng trận đó</b>.
                    Bạn chỉ ăn tiền từ trận mình đoán trúng — không lẹm sang trận khác.
                  </li>
                  <li>
                    <b>Có người trúng là chốt được ngay trận đó</b> — không cần đợi
                    hết các trận trong ngày.
                  </li>
                  <li>
                    Trúng <b>nhiều trận</b> → cộng dồn. Đoán <b>trật</b> → 20.000đ đó
                    nằm trong quỹ trận, cho người trúng trận ấy.
                  </li>
                </ul>

                <h3 className="mb-1 mt-3 font-bold text-grass">
                  4. Quỹ treo (trận chưa ai trúng)
                </h3>
                <ul className="list-disc space-y-1 pl-5">
                  <li>
                    Trận <b>không ai đoán trúng</b> → quỹ trận đó thành <b>quỹ treo</b>,
                    giữ riêng <b>theo từng trận</b> (nhớ ai đã chơi trận đó).
                  </li>
                  <li>
                    Sau này có ai <b>đoán trúng một trận</b> thì ngoài quỹ trận vừa
                    trúng, người đó còn nhận quỹ treo của <b>mỗi trận treo mà chính họ
                    có chơi</b>.
                  </li>
                  <li>
                    Nếu <b>nhiều người cùng trúng</b> một trận và cùng có chơi một trận
                    treo → quỹ treo trận đó <b>chia đều</b> cho họ.
                  </li>
                  <li>
                    Trận treo mà <b>người trúng không chơi</b> → vẫn treo tiếp, đợi
                    người trúng sau có chơi trận đó.
                  </li>
                </ul>

                <div className="mt-2 space-y-3 rounded-xl border border-grass/30 bg-grass/5 p-3 text-[13px]">
                  <p className="text-white/60">
                    Ví dụ: trước đó <b>trận A</b> (8 người đoán, 160.000đ) <b>không ai
                    trúng</b> → treo 160k. Hôm sau <b>trận B</b> có 2 người trúng: ba
                    Đức &amp; Ly.
                  </p>

                  <div>
                    <p className="mb-1 font-bold text-grass">📌 Quỹ trận B (160k)</p>
                    <p>
                      ba Đức &amp; Ly cùng trúng → <b>chia đôi 80.000đ</b> mỗi người.
                    </p>
                  </div>

                  <div>
                    <p className="mb-1 font-bold text-grass">📌 Quỹ treo trận A (160k)</p>
                    <p>
                      ba Đức <b>có chơi</b> trận A, Ly không → ba Đức nhận <b>trọn
                      160.000đ</b> treo của trận A. (Nếu cả hai đều có chơi trận A thì
                      chia đôi 80k mỗi người.)
                    </p>
                  </div>

                  <p className="border-t border-white/10 pt-2 text-white/70">
                    → Tổng: ba Đức <b className="text-neon">240.000đ</b> (80k + 160k),
                    Ly <b className="text-neon">80.000đ</b>. Nếu cả ba Đức lẫn Ly đều
                    không chơi trận A → trận A vẫn treo, đợi người trúng sau có chơi.
                  </p>
                </div>
              </section>
            </div>
        </Modal>
      )}
    </>
  );
}
